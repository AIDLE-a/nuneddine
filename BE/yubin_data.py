"""
[담당: 유빈]
yfinance + NewsAPI로 주가·뉴스 데이터를 수집.
스스로 "정보 불확실성"을 판단해서 같이 반환.

환경변수:
  USE_MOCK_DATA=false  실제 API 사용
  NEWS_API_KEY=<key>   NewsAPI 키 (https://newsapi.org)
"""
import os
import requests
import yfinance as yf
from datetime import datetime, timedelta
from schemas import StockDataResult, NewsItem

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")

# 종목코드 → 영문 검색 키워드 매핑
TICKER_KEYWORD_MAP = {
    "005930.KS": "Samsung Electronics semiconductor",
    "000660.KS": "SK Hynix HBM memory",
    "TSLA": "Tesla EV",
    "AAPL": "Apple iPhone",
    "035900.KS": "JYP Entertainment Kpop",
    "041510.KS": "SM Entertainment Kpop",
    "035420.KS": "NAVER",
    "035720.KS": "Kakao",
    "005380.KS": "Hyundai Motor",
    "000270.KS": "Kia Motors",
    "373220.KS": "LG Energy Solution battery",
    "006400.KS": "Samsung SDI battery",
    "051910.KS": "LG Chem",
    "207940.KS": "Samsung Biologics",
    "068270.KS": "Celltrion",
    "NVDA": "NVIDIA GPU AI",
    "AMD": "AMD GPU processor",
    "MSFT": "Microsoft Azure AI",
    "GOOGL": "Google Alphabet AI",
    "META": "Meta Facebook AI",
    "MRNA": "Moderna mRNA vaccine",
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
    stock = yf.Ticker(ticker)
    hist = stock.history(period="10d")  # 충분히 가져와서 최근 7거래일 추출
    if hist.empty:
        raise ValueError(f"{ticker} 주가 데이터를 가져올 수 없습니다")
    closes = [round(float(v), 2) for v in hist["Close"].tolist()]
    recent_7 = closes[-7:]  # 최근 7거래일
    return recent_7[-1], recent_7


def _fetch_news(ticker: str) -> list[NewsItem]:
    """NewsAPI에서 최근 7일 뉴스 수집 (유빈 담당)"""
    if not NEWS_API_KEY:
        return []

    keyword = TICKER_KEYWORD_MAP.get(ticker, ticker)
    from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": keyword,
        "apiKey": NEWS_API_KEY,
        "language": "en",
        "sortBy": "publishedAt",
        "from": from_date,
        "pageSize": 100,
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        articles = response.json().get("articles", [])

        # 제목에 키워드가 포함된 것만 필터링 (filter_news.py 로직)
        base_keyword = keyword.split()[0].lower()
        filtered = [
            a for a in articles
            if a.get("title") and base_keyword in a["title"].lower()
        ]

        return [
            NewsItem(
                title=a["title"],
                source=a.get("source", {}).get("name", ""),
                url=a.get("url", ""),
                published_at=a.get("publishedAt", ""),
            )
            for a in filtered
        ]
    except Exception as e:
        print(f"⚠️ 뉴스 수집 실패: {e}")
        return []


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
