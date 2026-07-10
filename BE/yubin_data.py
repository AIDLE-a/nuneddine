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


def get_stock_data(ticker: str) -> StockDataResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK:
        return _get_mock_data(ticker)

    price, price_history = _fetch_price(ticker)
    news = _fetch_news(ticker)
    info_warning = _check_info_uncertainty(news)
    return StockDataResult(ticker=ticker, price=price, price_history=price_history, news=news, info_warning=info_warning)


def _fetch_price(ticker: str) -> tuple[float, list[float]]:
    import time
    last_err = None
    for attempt in range(3):
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="10d")
            if not hist.empty:
                closes = [round(float(v), 2) for v in hist["Close"].tolist()]
                recent_7 = closes[-7:]
                return recent_7[-1], recent_7
        except Exception as e:
            last_err = e
        time.sleep(2 ** attempt)
    raise ValueError(f"{ticker} 주가 데이터를 가져올 수 없습니다: {last_err}")


def _parse_dt(item: "NewsItem") -> datetime:
    try:
        s = item.published_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        # timezone 정보 제거해서 naive로 통일
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


def _fetch_yfinance_news(ticker: str) -> list["NewsItem"]:
    """yfinance 내장 뉴스 — 티커와 직접 연관된 최신 기사 (무료, 키 불필요)"""
    try:
        raw = yf.Ticker(ticker).news or []
        items = []
        for n in raw:
            # yfinance 버전에 따라 구조가 다름 — 둘 다 처리
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
    """Google News RSS — 무료, API 키 불필요, 최신 뉴스 50개"""
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
            if title:
                items.append(NewsItem(title=title, source=source, url=link, published_at=iso_date))
        return items
    except Exception as e:
        print(f"⚠️ Google News RSS 수집 실패: {e}")
        return []


def _fetch_news(ticker: str) -> list[NewsItem]:
    """
    4개 소스에서 최신 관련 뉴스를 수집해 합산.

    우선순위:
      1. yfinance 내장 뉴스 (티커 직접 연관, 무료)
      2. 네이버 뉴스 API (한국어, 100개)
      3. Google News RSS 한국어 (무료, 키 불필요)
      4. NewsAPI (영어 보완)
    """
    keyword_en, keyword_kr = _get_ticker_keywords(ticker)
    # NewsAPI 필터: 키워드 단어 중 하나라도 제목에 있으면 통과
    filter_words = {w.lower() for w in keyword_en.split() if len(w) > 2}

    ko_news: list[NewsItem] = []
    en_news: list[NewsItem] = []

    # ── 1. yfinance 내장 뉴스 ────────────────────────────────────────────
    yf_news = _fetch_yfinance_news(ticker)
    en_news.extend(yf_news)

    # ── 2. 네이버 뉴스 (한국어, 최대 100개) ─────────────────────────────
    if NAVER_CLIENT_ID and NAVER_CLIENT_SECRET:
        try:
            res = requests.get(
                "https://openapi.naver.com/v1/search/news.json",
                headers={
                    "X-Naver-Client-Id": NAVER_CLIENT_ID,
                    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
                },
                params={"query": keyword_kr, "display": 100, "sort": "date"},
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
                    ko_news.append(NewsItem(
                        title=clean_title,
                        source="네이버 뉴스",
                        url=it.get("link", ""),
                        published_at=iso_date,
                    ))
        except Exception as e:
            print(f"⚠️ 네이버 뉴스 수집 실패: {e}")

    # ── 3. Google News RSS (한국어) ───────────────────────────────────────
    google_ko = _fetch_google_news(keyword_kr, lang="ko", country="KR")
    ko_news.extend(google_ko)

    # ── 4. NewsAPI (영어 보완) ────────────────────────────────────────────
    if NEWS_API_KEY:
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        try:
            response = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": keyword_en,
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
                    # 제목에 키워드 단어 중 하나라도 있으면 통과 (이전보다 완화)
                    if title and any(w in title.lower() for w in filter_words):
                        en_news.append(NewsItem(
                            title=title,
                            source=a.get("source", {}).get("name", "NewsAPI"),
                            url=a.get("url", ""),
                            published_at=a.get("publishedAt", ""),
                        ))
        except Exception as e:
            print(f"⚠️ NewsAPI 수집 실패: {e}")

    # ── 각각 최신순 정렬 ─────────────────────────────────────────────────
    ko_news.sort(key=_parse_dt, reverse=True)
    en_news.sort(key=_parse_dt, reverse=True)

    # ── 중복 제거 (제목 기준) 후 한국어 우선 합산 ────────────────────────
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in ko_news + en_news:
        key = item.title.strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(item)

    print(
        f"📰 뉴스 수집 완료 — "
        f"yfinance: {len(yf_news)}개 / 네이버: {len(ko_news) - len(google_ko)}개 / "
        f"Google RSS: {len(google_ko)}개 / NewsAPI: {len(en_news) - len(yf_news)}개 → "
        f"최종: {len(unique)}개"
    )
    return unique


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
            title="반도체 업황 회복 기대감 확산",
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