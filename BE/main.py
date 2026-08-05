"""
통합 FastAPI 서버
- /api/login      : Firebase 구글 로그인 검증 (담당: 채민/로그인팀)
- /api/analyze    : 주식 분석 오케스트레이터 (담당: 희선)
                    뉴스 수집(유빈) → 감성분석(연우) → 예측(희선) → Critic(희선)
- /api/evaluation : 추천시스템 오프라인 평가 지표 리포트 (담당: 희선)

실행: uvicorn main:app --reload

⚠️ 수정 노트 [★추가]:
   프론트(ReliabilityCard.jsx)가 "종합 신뢰도" 카드의 정보/감성/예측/리포트
   서브스코어를 자체적으로 재계산하고 있어서 critic.py 로직과 어긋나는 문제가
   있었음 → critic.review()가 이제 confidence_breakdown(dict)도 반환하도록
   바뀌었고, 이 파일에서도 그 값을 받아 응답(confidence_breakdown 필드)에
   그대로 실어줌. 프론트는 이제 재계산 없이 이 값을 표시만 하면 됨.

   ⚠️ 이 필드를 프론트가 받으려면 schemas.py의 StockAnalysisResponse에
   `confidence_breakdown: dict | None = None` 필드를 추가해야 함 (별도 안내 참고).
"""
from dotenv import load_dotenv
from datetime import datetime, timedelta
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import math
import os

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests as http_requests
from yubin_data import get_price_on_date

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore as firebase_firestore

from pydantic import BaseModel
# 팀 합의 스키마 파일에서 필요한 클래스들을 로드합니다.
from schemas import StockAnalysisResponse, SentimentResult, Sentiment
from prediction_record import save_prediction_record, load_prediction_records, load_all_records


# ----------------------------------------------------
# 실제 BE 폴더 내 파일명으로 임포트 연결
# ----------------------------------------------------
import yubin_data as data_service            # 1단계: 뉴스 및 주가 수집
import yeonwoo_sentiment as sentiment_service # 2단계: 감성 분석 & XAI
import heesun_forecast as prediction_service  # 3단계: Prophet 시계열 예측
import heesun_recommend                      # 하이브리드 추천 에이전트
import critic                                # 4단계: Critic 모순 검증

from heesun_recommend_eval import run_full_evaluation

app = FastAPI(title="주식 리서치 통합 서버")

# 추천시스템 오프라인 평가 결과 메모리 캐시 변수
EVALUATION_CACHE = None

# CORS 에러 해결을 위해 allow_origins 설정 (Vite 프론트엔드 호환)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _find_bad_floats(obj, path="root"):
    """응답 데이터에서 NaN/Infinity 값을 찾아 경로를 출력하는 디버깅용 함수"""
    bad = []
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            bad.append((path, obj))
    elif isinstance(obj, dict):
        for k, v in obj.items():
            bad.extend(_find_bad_floats(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            bad.extend(_find_bad_floats(v, f"{path}[{i}]"))
    return bad

def _build_reason_text(base_ticker: str, from_content: bool, from_cf: bool, sector_kr: str) -> str:
    """연관 종목 추천 이유를 사람이 읽을 수 있는 문장으로 변환 (프론트 '?' 버튼 툴팁용)"""
    reasons = []
    if from_content:
        reasons.append(f"최근 90일간 {base_ticker}와(과) 주가 움직임이 비슷했습니다")
    if from_cf:
        reasons.append(f"{base_ticker}에 관심등록한 다른 사용자들이 이 종목도 함께 관심등록했습니다")
    if not reasons and sector_kr:
        reasons.append(f"'{sector_kr}' 섹터에서 함께 묶이는 종목입니다")
    if not reasons:
        reasons.append("업종·시장 특성이 유사해 추천되었습니다")
    return " · ".join(reasons)


# Firebase Admin SDK 초기화
try:
    if not firebase_admin._apps:
        cred_path = Path(__file__).parent / "firebase_config.json"
        if cred_path.exists():
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
            print("🚀 Firebase Admin SDK 초기화 성공!")
        else:
            print("⚠️ firebase_config.json 파일이 없어 Firebase 기능을 비활성화합니다.")
except Exception as e:
    print(f"⚠️ Firebase 초기화 실패 (로그인 기능 비활성화): {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


# 섹터별 한국 종목 폴백 목록
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
    "035900.KQ": "JYP엔터테인먼트",
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
        try:
            base_info = _yf.Ticker(ticker).info
            base_sector_en = base_info.get("sector") or base_info.get("industry") or ""
            base_sector_kr = _SECTOR_KR.get(base_sector_en, "")
        except Exception:
            base_sector_en = ""
            base_sector_kr = ""

        yahoo_symbols = []
        try:
            url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{ticker}"
            resp = http_requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            recs = resp.json().get("finance", {}).get("result", [{}])[0].get("recommendedSymbols", [])
            yahoo_symbols = [r.get("symbol") for r in recs[:12] if r.get("symbol") and r.get("symbol") != ticker]
        except Exception:
            pass

        candidate_pool = heesun_recommend.get_expanded_candidate_pool(ticker, base_sector_kr)
        if not candidate_pool:
            candidate_pool = list(yahoo_symbols)
            if base_sector_kr:
                candidate_pool.extend([t for t, _ in _SECTOR_FALLBACK.get(base_sector_kr, [])])
            candidate_pool = list(set(t for t in candidate_pool if t and t != ticker))

        if candidate_pool:
            try:
                hybrid_result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
            except Exception as e:
                print(f"⚠️ 하이브리드 추천 실패, 폴백으로 진행: {e}")
                hybrid_result = {"results": [], "cf_weight": 0}

            if hybrid_result["results"]:
                reason_map = {r["ticker"]: r for r in hybrid_result["results"]}
                rec_tickers = list(reason_map.keys())

                with ThreadPoolExecutor(max_workers=8) as ex:
                    info_map = dict(ex.map(_get_info, rec_tickers))

                results = []
                for t in rec_tickers:
                    if t not in info_map:
                        continue
                    item = dict(info_map[t])
                    reason = reason_map[t]
                    item["reason"] = _build_reason_text(
                        ticker, reason["from_content"], reason["from_cf"], base_sector_kr
                    )
                    item["from_content"] = reason["from_content"]
                    item["from_cf"] = reason["from_cf"]
                    results.append(item)

                if results:
                    return {
                        "results": results[:6],
                        "cf_weight": hybrid_result["cf_weight"],
                    }

        if yahoo_symbols:
            with ThreadPoolExecutor(max_workers=8) as ex:
                info_map = dict(ex.map(_get_info, yahoo_symbols))
            results = []
            for s in yahoo_symbols:
                item = info_map.get(s)
                if not item:
                    continue
                if base_sector_kr and item["sector"] != base_sector_kr and item["sector"] != "기타":
                    continue
                item = dict(item)
                item["reason"] = f"야후 파이낸스가 {ticker}와(과) 함께 검색된 종목으로 추천했습니다."
                item["from_content"] = False
                item["from_cf"] = False
                results.append(item)
            if results:
                return {"results": results[:6], "cf_weight": 0}

        if base_sector_kr:
            fallback = _SECTOR_FALLBACK.get(base_sector_kr, [])
            results = [
                {
                    "ticker": t,
                    "name": n,
                    "sector": base_sector_kr,
                    "reason": f"'{base_sector_kr}' 섹터에 속한 대표 종목이라 추천했습니다.",
                    "from_content": False,
                    "from_cf": False,
                }
                for t, n in fallback if t != ticker
            ]
            if results:
                return {"results": results, "cf_weight": 0}

        return {"results": [], "cf_weight": 0}
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
            if not code or not name or not (len(code) == 6 and code.isdigit()):
                continue
            suffix = ".KQ" if type_code == "KOSDAQ" else ".KS"
            results.append({"ticker": code + suffix, "name": name, "exchange": type_code})
        return results
    except Exception:
        return []


@app.get("/api/search")
def search_stocks(q: str):
    try:
        seen = set()
        results = []

        def _add(items):
            for it in items:
                if it["ticker"] not in seen and it["ticker"]:
                    seen.add(it["ticker"])
                    results.append(it)

        _add(_naver_search(q))
        _add(_yahoo_search(q, region="US", lang="en-US", count=8))

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



# 코스피 주요 종목 목록
MAJOR_TICKERS = {
    "005930.KS": "삼성전자",
    "000660.KS": "SK하이닉스",
    "035420.KS": "NAVER",
    "035720.KS": "카카오",
    "005380.KS": "현대차",
    "000270.KS": "기아",
    "051910.KS": "LG화학",
    "006400.KS": "삼성SDI",
    "068270.KS": "셀트리온",
    "207940.KS": "삼성바이오로직스",
    "066570.KS": "LG전자",
    "012330.KS": "현대모비스",
    "017670.KS": "SK텔레콤",
    "030200.KS": "KT",
    "009150.KS": "삼성전기",
    "003550.KS": "LG",
    "086790.KS": "하나금융지주",
    "105560.KS": "KB금융",
    "055550.KS": "신한지주",
    "352820.KS": "하이브",
    "003490.KS": "대한항공",
    "028260.KS": "삼성물산",
    "032830.KS": "삼성생명",
    "010130.KS": "고려아연",
    "011200.KS": "HMM",
}

@app.get("/api/market-overview")
def market_overview():
    """급상승/급하락/인기 종목 API"""
    try:
        import yfinance as yf

        results = []
        tickers = list(MAJOR_TICKERS.keys())

        # 배치로 한번에 가져오기
        data = yf.download(tickers, period="2d", progress=False, group_by="ticker")

        for ticker, name in MAJOR_TICKERS.items():
            try:
                if len(tickers) == 1:
                    hist = data
                else:
                    hist = data[ticker] if ticker in data.columns.get_level_values(0) else None

                if hist is None or hist.empty or len(hist) < 2:
                    continue

                prev_close = float(hist["Close"].iloc[-2])
                curr_close = float(hist["Close"].iloc[-1])
                change_pct = round((curr_close - prev_close) / prev_close * 100, 2)

                results.append({
                    "ticker": ticker,
                    "name": name,
                    "price": curr_close,
                    "change_pct": change_pct,
                })
            except:
                continue

        # 급상승 TOP10
        rising = sorted([r for r in results if r["change_pct"] > 0], key=lambda x: x["change_pct"], reverse=True)[:10]
        # 급하락 TOP10
        falling = sorted([r for r in results if r["change_pct"] < 0], key=lambda x: x["change_pct"])[:10]

        # 인기 종목 (Firebase 분석 기록 기반)
        popular = []
        try:
            db = firebase_firestore.client()
            # 최근 1시간 분석 로그
            from datetime import datetime, timedelta, timezone
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=24)
            logs = db.collection("stockAnalysisLog").where(
                "analyzedAt", ">=", one_hour_ago
            ).stream()

            from collections import Counter
            counter = Counter()
            for log in logs:
                d = log.to_dict()
                counter[(d.get("ticker",""), d.get("name",""))] += 1

            popular = [
                {"ticker": t, "name": n, "count": c}
                for (t, n), c in counter.most_common(5)
            ]
        except:
            pass

        return {
            "rising": rising,
            "falling": falling,
            "popular": popular,
        }
    except Exception as e:
        return {"rising": [], "falling": [], "popular": [], "error": str(e)}


@app.get("/api/actual-price")
def get_actual_price(ticker: str, date: str):
    """
    특정 날짜의 실제 종가 조회
    date: YYYY-MM-DD 형식
    """
    try:
        import yfinance as yf
        from datetime import datetime, timedelta

        target = datetime.strptime(date, "%Y-%m-%d")
        # 다음 거래일까지 포함해서 조회
        end = target + timedelta(days=5)

        hist = yf.Ticker(ticker).history(
            start=target.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d")
        )

        if hist.empty:
            return {"ticker": ticker, "date": date, "actual_price": None}

        # 해당 날짜 또는 다음 거래일 종가
        row = hist.iloc[0]
        actual_date = hist.index[0].strftime("%Y-%m-%d")
        actual_price = round(float(row["Close"]), 2)

        return {
            "ticker": ticker,
            "requested_date": date,
            "actual_date": actual_date,
            "actual_price": actual_price,
        }
    except Exception as e:
        return {"ticker": ticker, "date": date, "actual_price": None, "error": str(e)}


@app.get("/api/predict-date")
def predict_date(ticker: str, target_date: str):
    """특정 날짜 주가 예측 + LLM 리포트 API"""
    try:
        from heesun_forecast import predict_until_date
        from groq import Groq
        from dotenv import load_dotenv
        from pathlib import Path
        import os

        result = predict_until_date(ticker, target_date)
        if "error" in result:
            return result

        # LLM 리포트 생성
        load_dotenv(dotenv_path=Path(__file__).parent / ".env")
        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

        prompt = f"""당신은 한국 증권사 수석 애널리스트입니다. 반드시 한국어로만 작성하세요.

종목: {ticker}
현재가: {result["current_price"]:,.0f}원
예측 날짜: {result["target_date"]} ({result["days_ahead"]}일 후)
AI 예측가: {result["predicted_price"]:,.0f}원
신뢰구간: {result["lower"]:,.0f} ~ {result["upper"]:,.0f}원
예상 변동률: {result["change_pct"]:+.2f}%

위 데이터를 기반으로 전문 투자 참고 리포트를 아래 형식으로 작성하세요.
각 섹션은 2~3문장으로 간결하게 작성하세요.

📊 예측 개요
(예측 날짜, 예측가, 현재가 대비 변동률 설명)

📈 상방 시나리오
(상방 {result["upper"]:,.0f}원 도달 조건과 근거)

📉 하방 시나리오  
(하방 {result["lower"]:,.0f}원 도달 조건과 근거)

⚠️ 불확실성 및 AI 한계
({result["days_ahead"]}일 후 예측의 한계, 주의사항)

※ AI 자동 생성 투자 참고용 자료. 투자 권유 아님."""

        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "한국 증권사 수석 애널리스트로서 간결하고 전문적인 한국어 리포트를 작성합니다. 모호한 표현 금지."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.2,
            )
            result["llm_report"] = response.choices[0].message.content
        except Exception as e:
            result["llm_report"] = None

        return result
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/prices")
def get_prices(tickers: str):
    import yfinance as yf
    result = {}
    for ticker in [t.strip() for t in tickers.split(",") if t.strip()]:
        price = None
        prev = None
        try:
            t_obj = yf.Ticker(ticker)
            fi = t_obj.fast_info
            price = (
                getattr(fi, "last_price", None)
                or getattr(fi, "lastPrice", None)
                or getattr(fi, "regular_market_price", None)
                or getattr(fi, "regularMarketPrice", None)
            )
            prev = (
                getattr(fi, "previous_close", None)
                or getattr(fi, "previousClose", None)
                or getattr(fi, "regular_market_previous_close", None)
            )
            if not price:
                hist = t_obj.history(period="2d")
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
                    prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else None
        except Exception:
            pass
        if price:
            change_pct = round((price - prev) / prev * 100, 2) if prev else None
            result[ticker] = {"price": round(float(price), 2), "change_pct": change_pct}
        else:
            result[ticker] = None
    return result


_active_uid: str = ""

class ActiveUserBody(BaseModel):
    uid: str

@app.get("/api/active-user")
def get_active_user():
    return {"uid": _active_uid}

@app.post("/api/active-user")
def set_active_user(body: ActiveUserBody):
    global _active_uid
    _active_uid = body.uid
    return {"ok": True}


@app.get("/api/watchlist")
def get_watchlist(uid: str):
    try:
        db = firebase_firestore.client()
        snap = db.collection("users").document(uid).get()
        favorites = snap.to_dict().get("favorites", []) if snap.exists else []
        return {"favorites": favorites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tamagotchi")
def get_tamagotchi(ticker: str):
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        fi = t.fast_info
        price = (
            getattr(fi, "last_price", None)
            or getattr(fi, "lastPrice", None)
            or getattr(fi, "regular_market_price", None)
        )
        prev = (
            getattr(fi, "previous_close", None)
            or getattr(fi, "previousClose", None)
            or getattr(fi, "regular_market_previous_close", None)
        )
        if not price:
            hist = t.history(period="2d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
        if not price:
            raise HTTPException(status_code=404, detail="가격 조회 실패")
        change_pct = ((price - prev) / prev * 100) if prev else 0.0
        return {"price": round(float(price), 2), "change_pct": round(change_pct, 2)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


# ── 희선 담당 (추천시스템 오프라인 평가 리포트 API) ──
@app.get("/api/evaluation")
def get_evaluation_report(force_refresh: bool = False):
    global EVALUATION_CACHE

    if EVALUATION_CACHE and not force_refresh:
        return EVALUATION_CACHE

    try:
        test_tickers = ["005930.KS", "000660.KS", "035420.KS", "064400.KS"]
        raw_report = run_full_evaluation(test_tickers)
        
        import json
        json_safe_report = json.loads(json.dumps(raw_report, default=str))

        if "summary" not in json_safe_report and "per_ticker" in json_safe_report:
            per_ticker = json_safe_report.get("per_ticker", {})
            details = []
            div_list, nov_list, acc_list, spd_list = [], [], [], []

            for t, val in per_ticker.items():
                div = float(val.get("diversity", {}).get("diversity", 0.0) or 0.0)
                nov = float(val.get("novelty", {}).get("novelty_score", 0.0) or 0.0)
                acc = float(val.get("accuracy_proxy", {}).get("accuracy_proxy", 0.0) or 0.0)
                spd = float(val.get("speed", {}).get("avg_seconds", 0.0) or 0.0) * 1000.0

                div_list.append(div)
                nov_list.append(nov)
                acc_list.append(acc)
                spd_list.append(spd)

                details.append({
                    "ticker": t,
                    "execution_time_ms": round(spd, 1),
                    "metrics": {
                        "diversity": div,
                        "novelty": nov,
                        "accuracy_proxy": acc
                    }
                })

            cov_val = float(json_safe_report.get("coverage", {}).get("coverage", 0.0) or 0.0)
            
            report = {
                "summary": {
                    "coverage": round(cov_val, 4),
                    "avg_diversity": round(sum(div_list)/len(div_list), 4) if div_list else 0.0,
                    "avg_novelty": round(sum(nov_list)/len(nov_list), 4) if nov_list else 0.0,
                    "avg_speed_ms": round(sum(spd_list)/len(spd_list), 1) if spd_list else 0.0,
                    "accuracy": {
                        "hit_rate": round(sum(acc_list)/len(acc_list), 4) if acc_list else 0.0,
                        "precision": round(sum(acc_list)/len(acc_list), 4) if acc_list else 0.0,
                        "recall": round(sum(acc_list)/len(acc_list), 4) if acc_list else 0.0
                    }
                },
                "details": details
            }
        else:
            report = json_safe_report

        EVALUATION_CACHE = report
        return report

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"평가 실행 중 오류 발생: {str(e)}")
    
@app.get("/api/prediction-records")
def get_all_prediction_records():
    """기록실 페이지 — 전체 종목 예측 기록 목록"""
    return {"results": load_all_records()}


@app.get("/api/prediction-records/{ticker}")
def get_prediction_records_by_ticker(ticker: str):
    """기록실 페이지 — 특정 종목 예측 기록 상세"""
    return load_prediction_records(ticker)


def _save_prediction_record_for_batch(ticker, stock_name, data_result, sentiment_result, prediction_result, llm_report=None):
    """예측 결과를 prediction_record.py 구조로 저장 — 실패해도 analyze()엔 영향 없게 별도 처리"""
    try:
        today = datetime.now()
        run_date = today.strftime("%Y. %m. %d.")

        composite_alpha = round(
            getattr(data_result, "flow_alpha", 0.0) * 0.30 +
            getattr(data_result, "financial_alpha", 0.0) * 0.20 +
            getattr(data_result, "momentum_alpha", 0.0) * 0.20,
            3
        )

        base_record = {
            "date": run_date,
            "currentPrice": getattr(data_result, "price", None),
            "compositeAlpha": composite_alpha,
            "sentiment": {
                "positive": getattr(sentiment_result.sentiment, "positive", None),
                "negative": getattr(sentiment_result.sentiment, "negative", None),
            },
            "newsCount": len(getattr(data_result, "news", []) or []),
            "llmReport": llm_report,
        }

        predictions = {}
        for p in getattr(prediction_result, "prediction", []) or []:
            horizon_key = f"d{p.day}"
            target_date = (today + timedelta(days=p.day)).strftime("%Y-%m-%d")
            predictions[horizon_key] = {
                "targetDate": target_date,
                "predictedPrice": p.future_price,
                "lower": p.lower,
                "upper": p.upper,
                "confidence": p.confidence_score,
            }

        save_prediction_record(ticker, stock_name, base_record, predictions)
    except Exception as e:
        print(f"⚠️ 예측 기록 저장 실패 (analyze는 정상 진행): {e}")

# ── 희선 담당 (주식 리서치 오케스트레이터) ──
# main.py 831번째 줄(def analyze)부터 파일 끝(if __name__...)까지를 아래 내용으로 통째로 교체하세요.

@app.get("/api/analyze", response_model=StockAnalysisResponse)
def analyze(ticker: str = "005930.KS"):
    try:
        # 1단계: 뉴스 수집 및 주가 기본 데이터 수집
        data_result = data_service.get_stock_data(ticker)
        stock_name = _KR_NAME_MAP.get(ticker, ticker)

        # 2단계: 뉴스 감성 분석 및 XAI
        news_confidence = getattr(getattr(data_result, "news_uncertainty", None), "confidence", 1.0)
        sentiment_result = sentiment_service.analyze(data_result.news, news_confidence=news_confidence)

        # 3단계: Prophet 기반 7일 주가 예측
        prediction_result = prediction_service.predict(
            ticker, data_result.price, sentiment_result.sentiment
        )

        # 4단계: Critic 모순 검증
        # [★추가] critic.review()가 이제 4번째 값으로 confidence_breakdown(dict)도 반환.
        # 프론트(ReliabilityCard.jsx)가 이 값을 그대로 표시하도록 응답에 실어줌.
        warnings, confidence_score, llm_report, confidence_breakdown = critic.review(
            data_result, sentiment_result, prediction_result
        )

        # 5단계: 예측 기록 저장 (batch_collect용)
        _save_prediction_record_for_batch(
            ticker, stock_name, data_result, sentiment_result, prediction_result, llm_report
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    # yeonwoo_sentiment.py의 explanation 스키마(type/title/chips/url)에 맞춤.
    pos_pct = int(sentiment_result.sentiment.positive * 100)
    neg_pct = int(sentiment_result.sentiment.negative * 100)

    raw_explanation = getattr(sentiment_result, "explanation", []) or []
    if raw_explanation and hasattr(raw_explanation[0], "dict"):
        raw_explanation = [item.dict() for item in raw_explanation]

    if not raw_explanation:
        # 실제 근거가 없으면 지어내지 않고 있는 그대로 알림
        raw_explanation = [{
            "type": "neutral",
            "title": "이번 분석에서는 호재/악재를 구분할 만큼 뉴스 근거가 충분하지 않습니다.",
            "chips": [],
            "url": "#",
        }]

    summary_text = getattr(sentiment_result, "top_keywords", None)
    if not summary_text or isinstance(summary_text, list):
        if isinstance(summary_text, list) and len(summary_text) > 0:
            summary_text = f"주요 이슈 키워드({', '.join(summary_text[:3])})를 바탕으로 수급 흐름을 점검했습니다."
        else:
            summary_text = (
                f"최근 수집된 {len(data_result.news)}건의 뉴스를 분석한 결과 "
                f"{stock_name}의 긍정 비율은 {pos_pct}%, 부정 비율은 {neg_pct}%입니다."
            )

    response = StockAnalysisResponse(
        ticker=data_result.ticker,
        price=data_result.price,
        price_history=getattr(data_result, "price_history", []),
        volume_history=getattr(data_result, "volume_history", []),
        institution_history=getattr(data_result, "institution_history", []),
        foreign_history=getattr(data_result, "foreign_history", []),
        individual_history=getattr(data_result, "individual_history", []),
        investor_data=getattr(data_result, "investor_data", []),
        financial=getattr(data_result, "financial", None),
        realtime=getattr(data_result, "realtime", []),
        news=data_result.news,
        prediction=prediction_result.prediction,
        sentiment=sentiment_result.sentiment,
        warnings=warnings,
        confidence_score=confidence_score,
        confidence_breakdown=confidence_breakdown,  # [★추가] 정보/신호일치도/예측/시장 서브스코어
        explanation=raw_explanation,   # 👈 contribution 보장된 근거 전달
        trend=sentiment_result.trend,
        calculation_note=getattr(sentiment_result, "calculation_note", None),
        top_keywords=summary_text,     # 👈 종목별 유일 요약문 전달
        volatility=sentiment_result.volatility,
        volume_analysis=getattr(prediction_result, "volume_analysis", None),
        news_agent_report=getattr(getattr(data_result, "news_uncertainty", None), "reasoning", None),
        news_agent_confidence=getattr(getattr(data_result, "news_uncertainty", None), "confidence", None),
        news_agent_epistemic=getattr(getattr(data_result, "news_uncertainty", None), "epistemic", None),
        news_agent_aleatoric=getattr(getattr(data_result, "news_uncertainty", None), "aleatoric", None),
        critic_report=llm_report,
        flow_alpha=getattr(data_result, "flow_alpha", 0.0),
        financial_alpha=getattr(data_result, "financial_alpha", 0.0),
        momentum_alpha=getattr(data_result, "momentum_alpha", 0.0),
        composite_alpha=round(
            getattr(data_result, "flow_alpha", 0.0) * 0.30 +
            getattr(data_result, "financial_alpha", 0.0) * 0.20 +
            getattr(data_result, "momentum_alpha", 0.0) * 0.20,
            3
        ),
    )

    bad_fields = _find_bad_floats(response.model_dump())
    if bad_fields:
        print("🚨 잘못된 float 값(NaN/Inf) 발견:", bad_fields)

    return response


@app.get("/api/actual-price")
def get_actual_price(ticker: str, date: str):
    """PredictionVerifier가 호출 — 특정 날짜 실제 종가 조회 (저장은 안 함)"""
    price = data_service.get_price_on_date(ticker, date)
    if price is None:
        raise HTTPException(status_code=404, detail="해당 날짜 종가를 찾을 수 없습니다")
    return {"actual_price": price, "actual_date": date}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)