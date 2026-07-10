"""
통합 FastAPI 서버
- /api/login  : Firebase 구글 로그인 검증 (담당: 채민/로그인팀)
- /api/analyze: 주식 분석 오케스트레이터 (담당: 희선)
               뉴스 수집(유빈) → 감성분석(연우) → 예측(희선) → Critic(희선)

실행: uvicorn main:app --reload
"""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import requests as http_requests

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from schemas import StockAnalysisResponse
import yubin_data as data_service
import yeonwoo_sentiment as sentiment_service
import heesun_prediction as prediction_service
import critic

app = FastAPI(title="주식 리서치 통합 서버")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Firebase Admin SDK 초기화 (firebase_config.json 파일이 BE/ 폴더에 있어야 함)
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase_config.json")
        firebase_admin.initialize_app(cred)
        print("🚀 Firebase Admin SDK 초기화 성공!")
except Exception as e:
    print(f"⚠️  Firebase 초기화 실패 (로그인 기능 비활성화): {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


# 섹터별 한국 종목 폴백 목록 (Yahoo 추천 API 결과 없을 때 사용)
_SECTOR_FALLBACK = {
    "엔터·미디어": [
        ("352820.KS", "HYBE"),
        ("041510.KQ", "SM엔터테인먼트"),
        ("047040.KS", "YG엔터테인먼트"),
        ("035900.KQ", "JYP엔터테인먼트"),
    ],
    "기술·IT": [
        ("035420.KS", "NAVER"),
        ("035720.KS", "카카오"),
        ("066570.KS", "LG전자"),
        ("017670.KS", "SK텔레콤"),
    ],
    "통신·미디어": [
        ("030200.KS", "KT"),
        ("017670.KS", "SK텔레콤"),
        ("035420.KS", "NAVER"),
        ("035720.KS", "카카오"),
    ],
    "반도체": [
        ("005930.KS", "삼성전자"),
        ("000660.KS", "SK하이닉스"),
    ],
    "금융": [
        ("105560.KS", "KB금융"),
        ("055550.KS", "신한지주"),
        ("086790.KS", "하나금융지주"),
    ],
    "헬스케어": [
        ("207940.KS", "삼성바이오로직스"),
        ("068270.KS", "셀트리온"),
    ],
    "전기차·자동차": [
        ("005380.KS", "현대차"),
        ("000270.KS", "기아"),
        ("012330.KS", "현대모비스"),
    ],
    "배터리": [
        ("373220.KS", "LG에너지솔루션"),
        ("006400.KS", "삼성SDI"),
        ("051910.KS", "LG화학"),
    ],
}

# 한국어 섹터명 매핑
_SECTOR_KR = {
    "Technology": "기술·IT",
    "Communication Services": "통신·미디어",
    "Consumer Cyclical": "소비재",
    "Consumer Defensive": "필수소비재",
    "Healthcare": "헬스케어",
    "Financial Services": "금융",
    "Industrials": "산업재",
    "Basic Materials": "소재",
    "Energy": "에너지",
    "Real Estate": "부동산",
    "Utilities": "유틸리티",
    "Entertainment": "엔터·미디어",
}

# 한국 주요 종목 한국어명 매핑 (yfinance가 영문만 제공하므로)
_KR_NAME_MAP = {
    "005930.KS": "삼성전자",
    "000660.KS": "SK하이닉스",
    "005380.KS": "현대차",
    "000270.KS": "기아",
    "035420.KS": "NAVER",
    "035720.KS": "카카오",
    "373220.KS": "LG에너지솔루션",
    "006400.KS": "삼성SDI",
    "051910.KS": "LG화학",
    "207940.KS": "삼성바이오로직스",
    "068270.KS": "셀트리온",
    "035900.KS": "JYP엔터테인먼트",
    "035900.KQ": "JYP엔터테인먼트",
    "041510.KS": "SM엔터테인먼트",
    "041510.KQ": "SM엔터테인먼트",
    "352820.KS": "HYBE",
    "047040.KS": "YG엔터테인먼트",
    "105560.KS": "KB금융",
    "055550.KS": "신한지주",
    "086790.KS": "하나금융지주",
    "003550.KS": "LG",
    "012330.KS": "현대모비스",
    "028260.KS": "삼성물산",
    "066570.KS": "LG전자",
    "034730.KS": "SK",
    "017670.KS": "SK텔레콤",
    "030200.KS": "KT",
    "096770.KS": "SK이노베이션",
    "011200.KS": "HMM",
    "000810.KS": "삼성화재",
}


@app.get("/api/related")
def related_stocks(ticker: str):
    """야후 파이낸스 자동 연관 종목 추천 — 결과 없으면 섹터 기반 폴백"""
    import yfinance as _yf
    from concurrent.futures import ThreadPoolExecutor

    def _get_info(sym):
        try:
            info = _yf.Ticker(sym).info
            name = _KR_NAME_MAP.get(sym) or info.get("shortName") or info.get("longName") or sym
            sector_en = info.get("sector") or info.get("industry") or ""
            sector = _SECTOR_KR.get(sector_en, sector_en or "기타")
            return sym, {"ticker": sym, "name": name, "sector": sector}
        except Exception:
            return sym, {"ticker": sym, "name": _KR_NAME_MAP.get(sym, sym), "sector": "기타"}

    try:
        # 현재 종목의 섹터 먼저 파악
        try:
            base_info = _yf.Ticker(ticker).info
            base_sector_en = base_info.get("sector") or base_info.get("industry") or ""
            base_sector_kr = _SECTOR_KR.get(base_sector_en, "")
        except Exception:
            base_sector_en = ""
            base_sector_kr = ""

        # 1차: Yahoo Finance 추천 API
        url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{ticker}"
        resp = http_requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        recs = resp.json().get("finance", {}).get("result", [{}])[0].get("recommendedSymbols", [])
        symbols = [r.get("symbol") for r in recs[:12] if r.get("symbol") and r.get("symbol") != ticker]

        if symbols:
            with ThreadPoolExecutor(max_workers=8) as ex:
                info_map = dict(ex.map(_get_info, symbols))
            # 같은 섹터 종목만 필터링 (섹터 정보가 없으면 전체 허용)
            results = []
            for s in symbols:
                item = info_map.get(s)
                if not item:
                    continue
                if base_sector_kr and item["sector"] != base_sector_kr and item["sector"] != "기타":
                    continue
                results.append(item)
            if results:
                return {"results": results[:6]}

        # 2차 폴백: 섹터 기반 목록
        if base_sector_kr:
            fallback = _SECTOR_FALLBACK.get(base_sector_kr, [])
            results = [
                {"ticker": t, "name": n, "sector": base_sector_kr}
                for t, n in fallback if t != ticker
            ]
            if results:
                return {"results": results}

        return {"results": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _yahoo_search(q: str, region: str = "US", lang: str = "en-US", count: int = 8) -> list:
    url = (
        f"https://query2.finance.yahoo.com/v1/finance/search"
        f"?q={q}&lang={lang}&region={region}&quotesCount={count}&newsCount=0&enableFuzzyQuery=true"
    )
    resp = http_requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
    items = resp.json().get("quotes", [])
    return [
        {
            "ticker": it.get("symbol", ""),
            "name": it.get("shortname") or it.get("longname") or it.get("symbol", ""),
            "exchange": it.get("exchDisp", ""),
        }
        for it in items
        if it.get("quoteType") in ("EQUITY", "ETF") and it.get("symbol")
    ]


def _naver_search(q: str) -> list:
    """네이버 증권 자동완성 — 한국어 종목명 검색에 최적화"""
    try:
        from urllib.parse import quote
        url = f"https://ac.stock.naver.com/ac?q={quote(q)}&target=stock,index,marketindicator"
        resp = http_requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=4)
        data = resp.json()
        results = []
        for item in data.get("items", []):
            code = item.get("code", "")
            name = item.get("name", "")
            type_code = item.get("typeCode", "KOSPI")
            # 한국 주식 코드는 반드시 6자리 숫자 — 4자리 일본 코드 등 차단
            if not code or not name or not (len(code) == 6 and code.isdigit()):
                continue
            suffix = ".KQ" if type_code == "KOSDAQ" else ".KS"
            results.append({"ticker": code + suffix, "name": name, "exchange": type_code})
        return results
    except Exception:
        return []


@app.get("/api/search")
def search_stocks(q: str):
    """전 세계 모든 상장 종목 검색 — 한국어·영어·티커 모두 지원"""
    try:
        seen = set()
        results = []

        def _add(items):
            for it in items:
                if it["ticker"] not in seen and it["ticker"]:
                    seen.add(it["ticker"])
                    results.append(it)

        # 1. 네이버 금융 — 한국어 종목명에 가장 정확
        _add(_naver_search(q))

        # 2. 야후 파이낸스 글로벌 — 미국/해외 종목 및 영문 티커
        _add(_yahoo_search(q, region="US", lang="en-US", count=8))

        # 3. 숫자 6자리 직접 입력 시 KS/KQ 둘 다 시도
        if not results and q.isdigit() and len(q) == 6:
            for suffix in [".KS", ".KQ"]:
                ticker = q + suffix
                try:
                    import yfinance as _yf
                    info = _yf.Ticker(ticker).info
                    name = _KR_NAME_MAP.get(ticker) or info.get("shortName") or info.get("longName")
                    if name:
                        results.append({"ticker": ticker, "name": name, "exchange": "KRX"})
                        break
                except Exception:
                    pass

        return {"results": results[:10]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 현재가 일괄 조회 (랭킹·드롭다운용) ──
@app.get("/api/prices")
def get_prices(tickers: str):
    import yfinance as yf
    result = {}
    for ticker in [t.strip() for t in tickers.split(",") if t.strip()]:
        price = None
        try:
            t_obj = yf.Ticker(ticker)
            fi = t_obj.fast_info
            price = (
                getattr(fi, "last_price", None)
                or getattr(fi, "lastPrice", None)
                or getattr(fi, "regular_market_price", None)
                or getattr(fi, "regularMarketPrice", None)
            )
            if not price:
                hist = t_obj.history(period="1d")
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
        except Exception:
            pass
        result[ticker] = round(float(price), 2) if price else None
    return result

# ── 채민 / 로그인팀 담당 ──
@app.post("/api/login")
async def login_check(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="인증 헤더(Authorization)가 누락되었습니다.")
    try:
        token_type, token = authorization.split(" ", 1)
        if token_type.lower() != "bearer":
            raise HTTPException(status_code=401, detail="올바른 Bearer 토큰 형식이 아닙니다.")
        decoded_token = firebase_auth.verify_id_token(token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "이메일 없음")
        return {
            "status": "success",
            "message": "백엔드 인증 성공!",
            "user": {"uid": uid, "email": email},
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"유효하지 않은 토큰입니다: {str(e)}")


# ── 희선 담당 (오케스트레이터) ──
@app.get("/api/analyze", response_model=StockAnalysisResponse)
def analyze(ticker: str = "005930.KS"):
    try:
        # 1. 뉴스/주가 수집 (유빈)
        data_result = data_service.get_stock_data(ticker)

        # 2. 감성 분석 (연우 - FinBERT)
        sentiment_result = sentiment_service.analyze(data_result.news)

        # 3. 주가 예측 (희선 - Prophet)
        prediction_result = prediction_service.predict(
            ticker, data_result.price, sentiment_result.sentiment
        )

        # 4. Critic 에이전트 — 최종 신뢰도 산출 (희선)
        warnings, confidence_score = critic.review(
            data_result, sentiment_result, prediction_result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return StockAnalysisResponse(
        ticker=data_result.ticker,
        price=data_result.price,
        price_history=data_result.price_history,
        news=data_result.news,
        prediction=prediction_result.prediction,
        sentiment=sentiment_result.sentiment,
        warnings=warnings,
        confidence_score=confidence_score,
        explanation=sentiment_result.explanation,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
