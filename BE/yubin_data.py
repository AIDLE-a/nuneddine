"""
[담당: 유빈]
yfinance + NewsAPI(영어) + Naver API(한국어)로 주가·뉴스 데이터를 수집.
스스로 "정보 불확실성"을 판단해서 같이 반환.

환경변수:
  USE_MOCK_DATA=false  실제 API 사용
  NEWS_API_KEY=<key>   NewsAPI 키 (https://newsapi.org)
  NAVER_CLIENT_ID=<id> 네이버 API Client ID
  NAVER_CLIENT_SECRET=<secret> 네이버 API Client Secret
"""
import os
import requests
import yfinance as yf
from datetime import datetime, timedelta
from schemas import StockDataResult, NewsItem
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")

TICKER_KEYWORD_MAP = {
    "005930.KS": ("Samsung Electronics semiconductor", "삼성전자 반도체"),
    "000660.KS": ("SK Hynix HBM memory", "SK하이닉스 HBM"),
    "TSLA": ("Tesla EV", "테슬라 전기차"),
    "AAPL": ("Apple iPhone", "애플 아이폰"),
    "035900.KS": ("JYP Entertainment Kpop", "JYP엔터테인먼트"),
    "035900.KQ": ("JYP Entertainment Kpop", "JYP엔터테인먼트"),
    "041510.KS": ("SM Entertainment Kpop", "SM엔터테인먼트"),
    "035420.KS": ("NAVER", "네이버"),
    "035720.KS": ("Kakao", "카카오"),
    "005380.KS": ("Hyundai Motor", "현대차"),
    "000270.KS": ("Kia Motors", "기아"),
    "373220.KS": ("LG Energy Solution battery", "LG에너지솔루션 배터리"),
    "006400.KS": ("Samsung SDI battery", "삼성SDI 배터리"),
    "051910.KS": ("LG Chem", "LG화학"),
    "207940.KS": ("Samsung Biologics", "삼성바이오로직스"),
    "068270.KS": ("Celltrion", "셀트리온"),
    "NVDA": ("NVIDIA GPU AI", "엔비디아"),
    "AMD": ("AMD GPU processor", "AMD 프로세서"),
    "MSFT": ("Microsoft Azure AI", "마이크로소프트 AI"),
    "GOOGL": ("Google Alphabet AI", "구글 AI"),
    "META": ("Meta Facebook AI", "메타 AI"),
    "MRNA": ("Moderna mRNA vaccine", "모더나 백신"),
}

# ── [추가] 노이즈 / 광고 / 스팸 / 무관 기사 차단 키워드 ──────────────────────────
EXCLUDE_KEYWORDS = [
    "추천주", "리딩방", "특가", "이벤트", "할인", "목표가", "종목분석", 
    "상한가", "급등주", "대박", "무료체험", "조건검색", "원룸", "분양",
    "포토", "인사", "동정", "부음", "결혼", "카톡방", "텔레그램", "찌라시"
]

# ── [추가] 티커별 필수 브랜드/기업명 (제목에 최소 1개 필수 포함) ────────────────
TICKER_ALIAS_MAP = {
    "005930.KS": ["삼성전자", "samsung"],
    "000660.KS": ["sk하이닉스", "하이닉스", "hynix"],
    "TSLA": ["테슬라", "tesla"],
    "AAPL": ["애플", "apple", "아이폰", "iphone"],
    "035900.KS": ["jyp", "제이와이피"],
    "035900.KQ": ["jyp", "제이와이피"],
    "041510.KS": ["sm엔터", "에스엠", "sm ent"],
    "035420.KS": ["네이버", "naver"],
    "035720.KS": ["카카오", "kakao"],
    "005380.KS": ["현대차", "현대자동차", "hyundai"],
    "000270.KS": ["기아", "kia"],
    "373220.KS": ["lg에너지솔루션", "lg엔솔"],
    "006400.KS": ["삼성sdi", "samsung sdi"],
    "051910.KS": ["lg화학", "lg chem"],
    "207940.KS": ["삼성바이오로직스", "삼바", "samsung biologics"],
    "068270.KS": ["셀트리온", "celltrion"],
    "NVDA": ["엔비디아", "nvidia"],
    "AMD": ["amd"],
    "MSFT": ["마이크로소프트", "microsoft"],
    "GOOGL": ["구글", "google", "알파벳", "alphabet"],
    "META": ["메타", "meta", "페이스북", "facebook"],
    "MRNA": ["모더나", "moderna"],
}


def get_stock_data(ticker: str) -> StockDataResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK:
        return _get_mock_data(ticker)

    price, price_history, volume_history = _fetch_price(ticker)
    news = _fetch_news(ticker)
    institution_history, foreign_history, individual_history, investor_data = _fetch_investor_data(ticker)
    financial = _fetch_financial_data(ticker)
    realtime = _fetch_realtime(ticker)
    info_warning = _check_info_uncertainty(news)
    news_uncertainty = _calc_news_uncertainty(news)
    print(f"📊 뉴스 에이전트 신뢰도: {news_uncertainty.confidence:.2f} | {news_uncertainty.reasoning}")
    return StockDataResult(
        news_uncertainty=news_uncertainty,
        ticker=ticker,
        price=price,
        price_history=price_history,
        volume_history=volume_history,
        institution_history=institution_history,
        foreign_history=foreign_history,
        individual_history=individual_history,
        investor_data=investor_data,
        financial=financial,
        realtime=realtime,
        news=news,
        info_warning=info_warning,
    )


def _fetch_price(ticker: str) -> tuple[float, list[float], list[float]]:
    import time
    last_err = None
    for attempt in range(3):
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            if not hist.empty:
                import math
                closes_raw = [float(v) for v in hist["Close"].tolist()]
                volumes_raw = [float(v) for v in hist["Volume"].tolist()]
                # nan 제거
                valid = [(c, v) for c, v in zip(closes_raw, volumes_raw) if not math.isnan(c)]
                if not valid:
                    raise ValueError("유효한 가격 데이터 없음")
                closes = [round(c, 2) for c, v in valid]
                volumes = [v for c, v in valid]
                return closes[-1], closes, volumes
        except Exception as e:
            last_err = e
        time.sleep(2 ** attempt)
    raise ValueError(f"{ticker} 주가 데이터를 가져올 수 없습니다: {last_err}")


def _parse_dt(item: "NewsItem") -> datetime:
    try:
        s = item.published_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        return datetime.min


def _get_ticker_keywords(ticker: str) -> tuple[str, str]:
    """TICKER_KEYWORD_MAP에 없으면 yfinance로 회사명 자동 조회"""
    if ticker in TICKER_KEYWORD_MAP:
        return TICKER_KEYWORD_MAP[ticker]
    try:
        info = yf.Ticker(ticker).info
        name = info.get("shortName") or info.get("longName") or ticker
        return name, name
    except Exception:
        return ticker, ticker


def _is_relevant_news(title: str, ticker: str) -> bool:
    """
    제목을 다각도로 분석하여 광고/스팸 및 무관 기사를 필터링합니다.
    유빈 님의 yubin_filter.py 아이디어를 통합 고도화.
    """
    if not title:
        return False
        
    title_clean = title.strip().lower()
    
    # 1. 스팸 / 광고 / 찌라시 키워드 차단
    if any(ex in title_clean for ex in EXCLUDE_KEYWORDS):
        return False
        
    # 2. 티커별 필수 상호명 포함 여부 확인
    aliases = TICKER_ALIAS_MAP.get(ticker, [])
    if aliases:
        if not any(alias in title_clean for alias in aliases):
            return False

    return True


def _fetch_yfinance_news(ticker: str) -> list["NewsItem"]:
    """yfinance 내장 뉴스 — 티커와 직접 연관된 최신 기사"""
    try:
        raw = yf.Ticker(ticker).news or []
        items = []
        for n in raw:
            content = n.get("content") or {}
            title = content.get("title") or n.get("title", "")
            url   = (content.get("canonicalUrl") or {}).get("url") or n.get("link", "")
            source = (content.get("provider") or {}).get("displayName") or n.get("publisher", "Yahoo Finance")
            pub = content.get("pubDate") or n.get("providerPublishTime")
            if isinstance(pub, int):
                iso_date = datetime.fromtimestamp(pub).isoformat()
            elif isinstance(pub, str):
                iso_date = pub
            else:
                iso_date = datetime.now().isoformat()
            if title:
                items.append(NewsItem(title=title, source=source, url=url, published_at=iso_date))
        return items
    except Exception as e:
        print(f"⚠️ yfinance 뉴스 수집 실패: {e}")
        return []


def _fetch_google_news(query: str, lang: str = "ko", country: str = "KR") -> list["NewsItem"]:
    """Google News RSS — 최신 뉴스 50개"""
    import xml.etree.ElementTree as ET
    from urllib.parse import quote
    from email.utils import parsedate_to_datetime
    try:
        url = (
            f"https://news.google.com/rss/search"
            f"?q={quote(query)}&hl={lang}&gl={country}&ceid={country}:{lang}"
        )
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return []
        root = ET.fromstring(resp.content)
        items = []
        for item in root.findall(".//item")[:50]:
            title = item.findtext("title", "")
            link  = item.findtext("link", "")
            pub   = item.findtext("pubDate", "")
            src_el = item.find("source")
            source = src_el.text if src_el is not None else "Google News"
            try:
                iso_date = parsedate_to_datetime(pub).isoformat()
            except Exception:
                iso_date = datetime.now().isoformat()
            import re
            raw_desc = item.findtext("description", "")
            # HTML 태그 + 엔티티 제거
            clean_desc = re.sub(r"<[^>]+>", "", raw_desc).strip() if raw_desc else ""
            clean_desc = clean_desc.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'").strip()
            # 제목이랑 똑같으면 description 비우기
            if clean_desc.startswith(title.split(" - ")[0][:20]):
                clean_desc = ""
            # 제목에서 " - 언론사명" 제거 (Google RSS 형식)
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0].strip()
                if not source or source == "Google News":
                    source = parts[1].strip()
            if title:
                items.append(NewsItem(title=title, source=source, url=link, published_at=iso_date, description=clean_desc))
        return items
    except Exception as e:
        print(f"⚠️ Google News RSS 수집 실패: {e}")
        return []


def _fetch_news(ticker: str) -> list[NewsItem]:
    """
    4개 소스 수집 + 통합 필터링 알고리즘 적용
    """
    keyword_en, keyword_kr = _get_ticker_keywords(ticker)

    ko_news: list[NewsItem] = []
    en_news: list[NewsItem] = []

    # 1. yfinance 내장 뉴스
    yf_news = _fetch_yfinance_news(ticker)
    en_news.extend(yf_news)

    # 2. 네이버 뉴스 API (주요 단어 정확 매칭 구문 설정)
    naver_id = os.getenv("NAVER_CLIENT_ID", "") or NAVER_CLIENT_ID
    naver_secret = os.getenv("NAVER_CLIENT_SECRET", "") or NAVER_CLIENT_SECRET
    if naver_id and naver_secret:
        try:
            main_kr = keyword_kr.split()[0]  # 예: "삼성전자"
            res = requests.get(
                "https://openapi.naver.com/v1/search/news.json",
                headers={
                    "X-Naver-Client-Id": naver_id,
                    "X-Naver-Client-Secret": naver_secret,
                },
                params={"query": f'"{main_kr}"', "display": 100, "sort": "date"},
                timeout=10,
            )
            if res.status_code == 200:
                for it in res.json().get("items", []):
                    clean_title = (
                        it["title"]
                        .replace("<b>", "").replace("</b>", "")
                        .replace("&quot;", '"').replace("&amp;", "&")
                        .replace("&#39;", "'")
                    )
                    pub_date = it.get("pubDate", "")
                    try:
                        dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S +0900")
                        iso_date = dt.isoformat()
                    except Exception:
                        iso_date = pub_date
                    clean_desc = (
                        it.get("description", "")
                        .replace("<b>", "").replace("</b>", "")
                        .replace("&quot;", '"').replace("&amp;", "&")
                        .replace("&#39;", "'")
                    )
                    ko_news.append(NewsItem(
                        title=clean_title,
                        source="네이버 뉴스",
                        url=it.get("link", ""),
                        published_at=iso_date,
                        description=clean_desc,
                    ))
        except Exception as e:
            print(f"⚠️ 네이버 뉴스 수집 실패: {e}")

    # 3. Google News RSS
    google_ko = _fetch_google_news(keyword_kr, lang="ko", country="KR")
    ko_news.extend(google_ko)

    # 4. NewsAPI (영어 - 큰따옴표 정확 매칭)
    if NEWS_API_KEY:
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        try:
            main_en = keyword_en.split()[0]  # 예: "Samsung" or "SK"
            response = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": f'"{main_en}"',
                    "apiKey": NEWS_API_KEY,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "from": from_date,
                    "pageSize": 100,
                },
                timeout=10,
            )
            if response.status_code == 200:
                for a in response.json().get("articles", []):
                    title = a.get("title", "") or ""
                    if title:
                        en_news.append(NewsItem(
                            title=title,
                            source=a.get("source", {}).get("name", "NewsAPI"),
                            url=a.get("url", ""),
                            published_at=a.get("publishedAt", ""),
                            description=a.get("description", "") or "",
                        ))
        except Exception as e:
            print(f"⚠️ NewsAPI 수집 실패: {e}")

    # 각각 최신순 정렬
    ko_news.sort(key=_parse_dt, reverse=True)
    en_news.sort(key=_parse_dt, reverse=True)

    # ── [핵심] 중복 제거 + 노이즈 정화 필터링 ────────────────────────────────
    seen: set[str] = set()
    unique: list[NewsItem] = []

    for item in ko_news + en_news:
        key = item.title.strip().lower()
        if key and key not in seen:
            seen.add(key)
            # ✨ 정밀 필터링 통과한 관련 기사만 담음
            if _is_relevant_news(item.title, ticker):
                unique.append(item)

    print(
        f"📰 뉴스 수집 완료 — "
        f"원천 수집: {len(ko_news) + len(en_news)}개 → "
        f"필터링 후 정화된 최종 뉴스: {len(unique)}개"
    )
    return unique


def _fetch_investor_data(ticker: str, pages: int = 10):
    """네이버 금융에서 기관/외국인/개인 순매매 데이터 수집"""
    try:
        if ".KS" not in ticker and ".KQ" not in ticker:
            return [], [], [], []

        code = ticker.replace(".KS", "").replace(".KQ", "")
        url = "https://finance.naver.com/item/frgn.naver"
        headers = {"User-Agent": "Mozilla/5.0"}

        import requests
        from io import StringIO
        import pandas as pd
        from schemas import InvestorData

        all_data = []
        for page in range(1, pages + 1):
            try:
                res = requests.get(url, headers=headers,
                                   params={"code": code, "page": page}, timeout=10)
                tables = pd.read_html(StringIO(res.text))
                df = tables[3]
                df.columns = ['날짜', '종가', '전일비', '등락률', '거래량',
                              '기관_순매매', '외국인_순매매', '외국인_보유주수', '외국인_보유율']
                df = df.dropna(subset=['날짜'])
                df = df[df['날짜'] != '날짜']
                if df.empty:
                    break
                all_data.append(df)
            except Exception:
                break

        if not all_data:
            return [], [], [], []

        full_df = pd.concat(all_data).reset_index(drop=True)

        institution = [float(v) if v == v else 0.0 for v in full_df['기관_순매매'].tolist()]
        foreign = [float(v) if v == v else 0.0 for v in full_df['외국인_순매매'].tolist()]
        individual = [-(i + f) for i, f in zip(institution, foreign)]

        investor_data = [
            InvestorData(
                date=str(row['날짜']),
                institution=float(row['기관_순매매']) if row['기관_순매매'] == row['기관_순매매'] else 0.0,
                foreign=float(row['외국인_순매매']) if row['외국인_순매매'] == row['외국인_순매매'] else 0.0,
                individual=-(float(row['기관_순매매'] if row['기관_순매매'] == row['기관_순매매'] else 0) +
                              float(row['외국인_순매매'] if row['외국인_순매매'] == row['외국인_순매매'] else 0)),
            )
            for _, row in full_df.iterrows()
        ]

        print(f"📊 수급 데이터 수집 완료: {len(investor_data)}일치")
        return institution, foreign, individual, investor_data

    except Exception as e:
        print(f"⚠️ 수급 데이터 수집 실패: {e}")
        return [], [], [], []


def _fetch_financial_data(ticker: str):
    """yFinance에서 핵심 재무 지표 수집"""
    try:
        from schemas import FinancialData
        stock = yf.Ticker(ticker)
        info = stock.info

        return FinancialData(
            per=info.get('trailingPE'),
            forward_per=info.get('forwardPE'),
            pbr=info.get('priceToBook'),
            roe=info.get('returnOnEquity'),
            debt_to_equity=info.get('debtToEquity'),
            revenue_growth=info.get('revenueGrowth'),
            earnings_growth=info.get('earningsGrowth'),
            operating_margin=info.get('operatingMargins'),
            current_ratio=info.get('currentRatio'),
        )
    except Exception as e:
        print(f"⚠️ 재무 데이터 수집 실패: {e}")
        return None


def _fetch_realtime(ticker: str) -> list:
    """1분 단위 실시간 주가 수집"""
    try:
        from schemas import RealtimePrice
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1d", interval="1m")
        if hist.empty:
            return []

        result = []
        for dt, row in hist.iterrows():
            time_str = dt.strftime("%H:%M")
            result.append(RealtimePrice(
                time=time_str,
                price=round(float(row["Close"]), 2),
                volume=int(row["Volume"]),
            ))
        print(f"⚡ 실시간 데이터 수집 완료: {len(result)}개")
        return result
    except Exception as e:
        print(f"⚠️ 실시간 데이터 수집 실패: {e}")
        return []



def _calc_news_uncertainty(news: list) -> "UncertaintyResult":
    """
    뉴스 에이전트 불확실성 정량화
    Epistemic: 데이터 부족 / Aleatoric: 데이터 노이즈
    """
    from schemas import UncertaintyResult
    from datetime import datetime

    if not news:
        return UncertaintyResult(
            epistemic=1.0, aleatoric=1.0, confidence=0.0,
            reasoning="뉴스 없음 — 분석 불가"
        )

    now = datetime.now()
    epistemic_scores = {}
    aleatoric_scores = {}
    details = []

    # ① 뉴스 수
    count_score = max(0.0, 1 - len(news) / 50)
    epistemic_scores["count"] = count_score
    details.append(f"{'✅' if count_score < 0.2 else '⚠️'} 뉴스 수 {len(news)}건")

    # ② 출처 다양성
    sources = set(n.source for n in news)
    source_score = max(0.0, 1 - len(sources) / 10)
    epistemic_scores["source"] = source_score
    details.append(f"{'✅' if source_score < 0.2 else '⚠️'} 출처 {len(sources)}개")

    # ③ 최근 24시간 비율
    recent_1d = 0
    recent_3d = 0
    for n in news:
        try:
            pub = _parse_dt(n)
            days = (now - pub.replace(tzinfo=None)).days
            if days <= 1: recent_1d += 1
            if days <= 3: recent_3d += 1
        except:
            pass
    recent_ratio = recent_1d / len(news)
    epistemic_scores["time"] = max(0.0, 1 - recent_ratio)
    details.append(f"{'✅' if recent_ratio > 0.5 else '⚠️'} 24h 뉴스 {recent_ratio*100:.0f}% / 3일 {recent_3d/len(news)*100:.0f}%")

    # ④ 주요 언론사 비율
    major = {"한국경제","매경","조선비즈","연합뉴스","서울경제","이데일리","머니투데이","헤럴드경제","bloomberg","reuters","cnbc","wsj"}
    major_count = sum(1 for n in news if any(m in n.source.lower() for m in major))
    major_ratio = major_count / len(news)
    epistemic_scores["major"] = max(0.0, 1 - major_ratio)
    details.append(f"{'✅' if major_ratio > 0.3 else '⚠️'} 주요언론 {major_ratio*100:.0f}% ({major_count}건)")

    # ⑤ description 보유율
    has_desc = sum(1 for n in news if n.description and len(n.description) > 20)
    desc_ratio = has_desc / len(news)
    aleatoric_scores["desc"] = max(0.0, 1 - desc_ratio)
    details.append(f"{'✅' if desc_ratio > 0.7 else '⚠️'} description {desc_ratio*100:.0f}%")

    # ⑥ 오래된 뉴스 비율
    old_count = 0
    for n in news:
        try:
            pub = _parse_dt(n)
            if (now - pub.replace(tzinfo=None)).days > 7:
                old_count += 1
        except:
            old_count += 1
    old_ratio = old_count / len(news)
    aleatoric_scores["old"] = old_ratio
    details.append(f"{'✅' if old_ratio < 0.2 else '⚠️'} 7일이상 {old_ratio*100:.0f}%")

    # ⑦ 중복 기사 비율
    prefixes = [n.title[:10] for n in news]
    dup_ratio = 1 - len(set(prefixes)) / len(prefixes)
    aleatoric_scores["dup"] = dup_ratio
    details.append(f"{'✅' if dup_ratio < 0.2 else '⚠️'} 중복 {dup_ratio*100:.0f}%")

    # ⑧ 짧은 제목 비율
    short_ratio = sum(1 for n in news if len(n.title) < 15) / len(news)
    aleatoric_scores["short"] = short_ratio
    details.append(f"{'✅' if short_ratio < 0.1 else '⚠️'} 짧은제목 {short_ratio*100:.0f}%")

    # 가중 평균
    epistemic = round(min(1.0, max(0.0,
        epistemic_scores["count"]  * 0.35 +
        epistemic_scores["source"] * 0.25 +
        epistemic_scores["time"]   * 0.25 +
        epistemic_scores["major"]  * 0.15
    )), 3)

    aleatoric = round(min(1.0, max(0.0,
        aleatoric_scores["desc"]  * 0.35 +
        aleatoric_scores["old"]   * 0.25 +
        aleatoric_scores["dup"]   * 0.25 +
        aleatoric_scores["short"] * 0.15
    )), 3)

    confidence = round(max(0.0, min(1.0, 1 - (epistemic * 0.6 + aleatoric * 0.4))), 3)

    # 리포트 형식으로 출력
    status = "우수" if confidence >= 0.85 else "양호" if confidence >= 0.70 else "보통" if confidence >= 0.50 else "낮음"
    ep_status = "낮음 ✅" if epistemic < 0.2 else "보통 ⚠️" if epistemic < 0.5 else "높음 ❌"
    al_status = "낮음 ✅" if aleatoric < 0.2 else "보통 ⚠️" if aleatoric < 0.5 else "높음 ❌"

    ep_details = " / ".join(d for d in details[:4])
    al_details = " / ".join(d for d in details[4:])

    reasoning = (
        f"\n╔══════════════════════════════════════════════════╗\n"
        f"║           📰 뉴스 에이전트 분석 리포트            ║\n"
        f"╠══════════════════════════════════════════════════╣\n"
        f"║  종합 신뢰도: {confidence:.2f} / 1.00  ({status}){' ' * (20 - len(status))}║\n"
        f"╠══════════════════════════════════════════════════╣\n"
        f"║  [Epistemic Uncertainty: {epistemic:.2f} — {ep_status}]{' ' * max(0, 14 - len(ep_status))}║\n"
        f"║  {ep_details[:50]:<50}║\n"
        f"╠══════════════════════════════════════════════════╣\n"
        f"║  [Aleatoric Uncertainty: {aleatoric:.2f} — {al_status}]{' ' * max(0, 14 - len(al_status))}║\n"
        f"║  {al_details[:50]:<50}║\n"
        f"╠══════════════════════════════════════════════════╣\n"
        f"║  판단: {'데이터 충분, 품질 양호' if confidence >= 0.8 else '데이터 보통, 추가 수집 권장' if confidence >= 0.6 else '데이터 부족, 신뢰도 낮음':<44}║\n"
        f"╚══════════════════════════════════════════════════╝"
    )

    return UncertaintyResult(
        epistemic=epistemic,
        aleatoric=aleatoric,
        confidence=confidence,
        reasoning=reasoning,
    )

def _check_info_uncertainty(news: list[NewsItem]) -> str | None:
    if len(news) < 10:
        return "뉴스 부족"
    return None


def _get_mock_data(ticker: str) -> StockDataResult:
    mock_prices = {
        "005930.KS": 72400,
        "000660.KS": 168500,
        "TSLA": 184.88,
        "AAPL": 214.32,
    }
    news = [
        NewsItem(
            title="삼성전자, 차세대 반도체 양산 계획 발표",
            source="한국경제",
            url="https://example.com/news/1",
            published_at=datetime.now().isoformat(),
        ),
        NewsItem(
            title="삼성전자 반도체 업황 회복 기대감 확산",
            source="매경",
            url="https://example.com/news/2",
            published_at=(datetime.now() - timedelta(days=1)).isoformat(),
        ),
    ]
    return StockDataResult(
        ticker=ticker,
        price=mock_prices.get(ticker, 72000),
        news=news,
        info_warning=_check_info_uncertainty(news),
    )