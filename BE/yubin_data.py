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


def _fetch_news(ticker: str) -> list[NewsItem]:
    """
    NewsAPI(영어)와 Naver API(한국어)를 모두 호출하여 병합.

    정렬 기준 (우선순위 순):
      1. 언어: 한국어 기사 우선 (lang_priority: 0=한국어, 1=영어)
      2. 날짜 최신순
      3. 가중치 점수: 한국어 뉴스 수가 많을수록 한국어 비중 ↑, 적을수록 영어 보완
    """
    keywords = TICKER_KEYWORD_MAP.get(ticker, (ticker, ticker))
    keyword_en, keyword_kr = keywords[0], keywords[1]
    base_keyword = keyword_en.split()[0].lower()

    ko_news: list[NewsItem] = []
    en_news: list[NewsItem] = []

    # ── 날짜 파싱 헬퍼 ───────────────────────────────────────────────────
    def _parse_dt(item: NewsItem) -> datetime:
        try:
            s = item.published_at.replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except Exception:
            return datetime.min

    # ── 1. 네이버 뉴스 수집 (한국어) ─────────────────────────────────────
    if NAVER_CLIENT_ID and NAVER_CLIENT_SECRET:
        try:
            res = requests.get(
                "https://openapi.naver.com/v1/search/news.json",
                headers={
                    "X-Naver-Client-Id": NAVER_CLIENT_ID,
                    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
                },
                params={"query": keyword_kr, "display": 50, "sort": "date"},
                timeout=10,
            )
            if res.status_code == 200:
                for it in res.json().get("items", []):
                    clean_title = (
                        it["title"]
                        .replace("<b>", "").replace("</b>", "")
                        .replace("&quot;", '"').replace("&amp;", "&")
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

    # ── 2. NewsAPI 수집 (영어) ────────────────────────────────────────────
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
                    "pageSize": 50,
                },
                timeout=10,
            )
            if response.status_code == 200:
                for a in response.json().get("articles", []):
                    if a.get("title") and base_keyword in a["title"].lower():
                        en_news.append(NewsItem(
                            title=a["title"],
                            source=a.get("source", {}).get("name", "NewsAPI"),
                            url=a.get("url", ""),
                            published_at=a.get("publishedAt", ""),
                        ))
        except Exception as e:
            print(f"⚠️ NewsAPI 수집 실패: {e}")

    # ── 3. 가중치: 한국어 많으면 영어는 보조로만 ─────────────────────────
    ko_count = len(ko_news)
    en_limit = max(10, 30 - ko_count)
    en_news = en_news[:en_limit]

    # ── 5. 각각 최신순 정렬 후 한국어 먼저 합치기 ────────────────────────
    ko_news.sort(key=_parse_dt, reverse=True)
    en_news.sort(key=_parse_dt, reverse=True)

    # ── 6. 중복 제거 후 반환 ──────────────────────────────────────────────
    seen_titles: set[str] = set()
    unique_news: list[NewsItem] = []
    for item in ko_news + en_news:
        if item.title not in seen_titles:
            seen_titles.add(item.title)
            unique_news.append(item)

    print(f"📰 뉴스 수집 완료 — 한국어: {ko_count}개 / 영어: {len(en_news)}개 → 최종: {len(unique_news)}개")
    return unique_news


def _check_info_uncertainty(news: list[NewsItem]) -> str | None:
    if len(news) < 5:
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