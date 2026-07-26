"""
[담당: 유빈]
yfinance + NewsAPI(영어) + Naver API(한국어)로 주가·뉴스 데이터를 수집.
스스로 "정보 불확실성"을 판단해서 같이 반환.

환경변수:
  USE_MOCK_DATA=false  실제 API 사용
  NEWS_API_KEY=<key>   NewsAPI 키 (https://newsapi.org)
  NAVER_CLIENT_ID=<id> 네이버 API Client ID
  NAVER_CLIENT_SECRET=<secret> 네이버 API Client Secret

⚠️ 수정 노트 (뉴스 필터링 버그 수정):
   TICKER_ALIAS_MAP에 없는 종목(예: 064400.KS LG씨엔에스)은 aliases=[]가 되어
   `if aliases:` 조건이 거짓이 되면서 필수 상호명 검사가 통째로 건너뛰어졌음.
   그 결과 EXCLUDE_KEYWORDS에만 안 걸리면 무관한 기사(예: LG트윈스 야구 뉴스)가
   그대로 통과되는 구조적 결함이 있었음.
   → 1) 064400.KS를 두 매핑에 정식 등록
     2) 매핑에 없는 종목도 검색에 사용한 keyword_kr 자체를 폴백 별칭으로 써서
        최소한의 필터링이 항상 걸리도록 구조 개선
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
    # ── 추가: LG씨엔에스 (뉴스 필터링 버그의 원인이었던 종목) ──
    "064400.KS": ("LG CNS IT service", "LG씨엔에스"),
}

# ── [추가] 노이즈 / 광고 / 스팸 / 무관 기사 차단 키워드 ──────────────────────────
EXCLUDE_KEYWORDS = [
    "추천주", "리딩방", "특가", "이벤트", "할인", "목표가", "종목분석", 
    "상한가", "급등주", "대박", "무료체험", "조건검색", "원룸", "분양",
    "포토", "인사", "동정", "부음", "결혼", "카톡방", "텔레그램", "찌라시",
    "냉장고", "전자레인지", "세탁기", "에어컨", "청소기", "식기세척기",
    "개그맨", "연예인", "배우", "가수", "아이돌", "드라마", "영화",
    "요리", "맛집", "여행", "패션", "뷰티", "인테리어",
    # ── 추가: 스포츠 관련 (종목명이 스포츠단/구단명과 겹칠 때 오염 방지) ──
    "트윈스", "야구", "축구", "농구", "배구", "투수", "타자", "홈런",
    "구단", "프로야구", "kbo", "K리그", "감독", "선수단",
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
    # ── 추가: LG씨엔에스 ──
    "064400.KS": ["lg씨엔에스", "lg cns", "엘지씨엔에스"],
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
    flow_alpha = _calc_flow_alpha(institution_history, foreign_history, individual_history)
    financial_alpha = _calc_financial_alpha(financial)
    momentum_alpha = _calc_momentum_alpha(price_history)
    market_index = _fetch_market_index() if ticker.endswith(".KS") or ticker.endswith(".KQ") else {}
    print(f"📊 수급 알파 팩터: {flow_alpha:.3f}")
    print(f"💰 재무 알파 팩터: {financial_alpha:.3f}")
    print(f"📈 모멘텀 알파 팩터: {momentum_alpha:.3f}")
    print(f"📊 뉴스 에이전트 신뢰도: {news_uncertainty.confidence:.2f} | {news_uncertainty.reasoning}")

    # ── 재수집 메커니즘 (신뢰도 낮으면 키워드 확장해서 재시도) ──
    retry_count = 0
    if news_uncertainty.confidence < 0.7:
        print(f"⚠️ 뉴스 신뢰도 낮음 ({news_uncertainty.confidence:.2f}) → 키워드 확장 재수집 시도")
        expanded_news = _fetch_news(ticker, expanded=True)
        if len(expanded_news) > len(news):
            news = expanded_news
            news_uncertainty = _calc_news_uncertainty(news)
            retry_count = 1
            print(f"🔄 재수집 완료: {len(news)}건 → 신뢰도: {news_uncertainty.confidence:.2f}")
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
        flow_alpha=flow_alpha,
        financial_alpha=financial_alpha,
        momentum_alpha=momentum_alpha,
        market_index=market_index,
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
    """TICKER_KEYWORD_MAP에 없으면 네이버 금융에서 한국어 종목명 자동 조회"""
    if ticker in TICKER_KEYWORD_MAP:
        return TICKER_KEYWORD_MAP[ticker]
    try:
        # 한국 종목이면 네이버 금융에서 한국어 이름 조회
        if ticker.endswith('.KS') or ticker.endswith('.KQ'):
            import requests
            from bs4 import BeautifulSoup
            code = ticker.replace('.KS', '').replace('.KQ', '')
            url = f'https://finance.naver.com/item/main.naver?code={code}'
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get(url, headers=headers, timeout=3)
            soup = BeautifulSoup(res.text, 'html.parser')
            name_tag = soup.select_one('div.wrap_company h2 a')
            if name_tag:
                kr_name = name_tag.text.strip()
                info = yf.Ticker(ticker).info
                en_name = info.get("shortName") or info.get("longName") or ticker
                return en_name, kr_name
        # 해외 종목은 영어로
        info = yf.Ticker(ticker).info
        name = info.get("shortName") or info.get("longName") or ticker
        return name, name
    except Exception:
        return ticker, ticker



def _get_korean_name(ticker: str) -> str:
    """네이버 금융에서 한국어 종목명 자동 조회"""
    try:
        import requests
        from bs4 import BeautifulSoup
        code = ticker.replace('.KS', '').replace('.KQ', '')
        url = f'https://finance.naver.com/item/main.naver?code={code}'
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=3)
        soup = BeautifulSoup(res.text, 'html.parser')
        name = soup.select_one('div.wrap_company h2 a')
        return name.text.strip() if name else ''
    except:
        return ''

# 종목명 캐시 (중복 호출 방지)
_korean_name_cache: dict = {}

def _get_aliases(ticker: str, keyword_kr: str = '') -> list:
    """티커에 대한 검색 aliases 자동 생성"""
    # 1. 기존 TICKER_ALIAS_MAP 우선
    if ticker in TICKER_ALIAS_MAP:
        return TICKER_ALIAS_MAP[ticker]

    # 2. 캐시 확인
    if ticker in _korean_name_cache:
        kr_name = _korean_name_cache[ticker]
    else:
        # 3. 네이버 금융에서 한국어 종목명 자동 조회
        kr_name = _get_korean_name(ticker)
        _korean_name_cache[ticker] = kr_name

    aliases = []
    if kr_name:
        aliases.append(kr_name.lower())
        aliases.append(kr_name.replace(' ', '').lower())
        # 앞 글자 변형 (예: "삼성전기" → "삼성전", "삼성")
        if len(kr_name) >= 4:
            aliases.append(kr_name[:4].lower())
        if len(kr_name) >= 3:
            aliases.append(kr_name[:3].lower())

    # 4. keyword_kr 폴백
    if keyword_kr and keyword_kr.strip().lower() not in aliases:
        fb = keyword_kr.strip().lower()
        aliases.extend([fb, fb.replace(' ', '')])

    return list(set(a for a in aliases if len(a) >= 2))

def _is_relevant_news(title: str, ticker: str, keyword_kr: str = "") -> bool:
    """
    제목을 다각도로 분석하여 광고/스팸 및 무관 기사를 필터링합니다.
    유빈 님의 yubin_filter.py 아이디어를 통합 고도화.

    ⚠️ 수정: TICKER_ALIAS_MAP에 없는 종목은 기존엔 필터링이 통째로 건너뛰어졌음.
    이제 매핑에 없으면 실제 검색에 쓴 keyword_kr을 폴백 별칭으로 사용해서
    최소한의 관련성 검사가 항상 걸리도록 함.
    """
    if not title:
        return False
        
    title_clean = title.strip().lower()
    
    # 1. 스팸 / 광고 / 찌라시 / 스포츠 오염 키워드 차단
    if any(ex in title_clean for ex in EXCLUDE_KEYWORDS):
        return False
        
    # 2. 티커별 aliases 자동 생성 (네이버 금융 한국어 종목명 포함)
    aliases = _get_aliases(ticker, keyword_kr)
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
            clean_desc = re.sub(r"<[^>]+>", "", raw_desc).strip() if raw_desc else ""
            clean_desc = clean_desc.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'").strip()
            if clean_desc.startswith(title.split(" - ")[0][:20]):
                clean_desc = ""
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


def _fetch_news(ticker: str, expanded: bool = False) -> list[NewsItem]:
    """
    4개 소스 수집 + 통합 필터링 알고리즘 적용

    ⚠️ 수정: expanded=True일 때 실제로 검색 범위를 넓히도록 구현.
    기존엔 파라미터만 받고 아무 동작도 안 해서 재수집 메커니즘이 무의미했음.
    확장 시: 회사명 단독 검색 + 관대해진 최소 매칭(별칭 중 하나만 있으면 통과)으로 완화.
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
            if ticker in TICKER_KEYWORD_MAP:
                main_kr = keyword_kr.split()[0]
            else:
                main_kr = keyword_kr
            # expanded=True면 회사명 뒤에 붙는 수식어(반도체, HBM 등)를 떼고
            # 가장 넓은 단어 하나로 재검색해서 더 많은 후보를 확보
            if expanded:
                main_kr = keyword_kr.split()[0]
            res = requests.get(
                "https://openapi.naver.com/v1/search/news.json",
                headers={
                    "X-Naver-Client-Id": naver_id,
                    "X-Naver-Client-Secret": naver_secret,
                },
                params={"query": f'"{main_kr}"' if not expanded else main_kr, "display": 100, "sort": "date"},
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

    # 4. NewsAPI (영어 - 큰따옴표 정확 매칭, expanded면 완화)
    if NEWS_API_KEY:
        from_date = (datetime.now() - timedelta(days=7 if not expanded else 14)).strftime("%Y-%m-%d")
        try:
            if ticker in TICKER_KEYWORD_MAP:
                main_en = keyword_en.split()[0]
            else:
                main_en = keyword_en
            response = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": f'"{main_en}"' if not expanded else main_en,
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

    ko_news.sort(key=_parse_dt, reverse=True)
    en_news.sort(key=_parse_dt, reverse=True)

    seen: set[str] = set()
    unique: list[NewsItem] = []

    for item in ko_news + en_news:
        key = item.title.strip().lower()
        if key and key not in seen:
            seen.add(key)
            if _is_relevant_news(item.title, ticker, keyword_kr):
                unique.append(item)

    print(
        f"📰 뉴스 수집 완료{'(확장)' if expanded else ''} — "
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

        rec_trend = []
        try:
            recs = stock.recommendations
            if recs is not None and not recs.empty:
                for _, row in recs.iterrows():
                    rec_trend.append({
                        "period": row.get("period", ""),
                        "strong_buy": int(row.get("strongBuy", 0)),
                        "buy": int(row.get("buy", 0)),
                        "hold": int(row.get("hold", 0)),
                        "sell": int(row.get("sell", 0)),
                        "strong_sell": int(row.get("strongSell", 0)),
                    })
        except:
            pass

        try:
            apt = stock.analyst_price_targets
            target_median = apt.get("median") if apt else None
        except:
            target_median = None

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
            target_mean_price=info.get('targetMeanPrice'),
            target_high_price=info.get('targetHighPrice'),
            target_low_price=info.get('targetLowPrice'),
            target_median_price=target_median,
            analyst_count=info.get('numberOfAnalystOpinions'),
            recommendation=info.get('recommendationKey'),
            recommendation_trend=rec_trend if rec_trend else None,
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

    count_score = max(0.0, 1 - len(news) / 50)
    epistemic_scores["count"] = count_score
    details.append(f"{'✅' if count_score < 0.2 else '⚠️'} 뉴스 수 {len(news)}건")

    sources = set(n.source for n in news)
    source_score = max(0.0, 1 - len(sources) / 10)
    epistemic_scores["source"] = source_score
    details.append(f"{'✅' if source_score < 0.2 else '⚠️'} 출처 {len(sources)}개")

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

    major = {"한국경제","매경","조선비즈","연합뉴스","서울경제","이데일리","머니투데이","헤럴드경제","bloomberg","reuters","cnbc","wsj"}
    major_count = sum(1 for n in news if any(m in n.source.lower() for m in major))
    major_ratio = major_count / len(news)
    epistemic_scores["major"] = max(0.0, 1 - major_ratio)
    details.append(f"{'✅' if major_ratio > 0.3 else '⚠️'} 주요언론 {major_ratio*100:.0f}% ({major_count}건)")

    has_desc = sum(1 for n in news if n.description and len(n.description) > 20)
    desc_ratio = has_desc / len(news)
    aleatoric_scores["desc"] = max(0.0, 1 - desc_ratio)
    details.append(f"{'✅' if desc_ratio > 0.7 else '⚠️'} description {desc_ratio*100:.0f}%")

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

    prefixes = [n.title[:10] for n in news]
    dup_ratio = 1 - len(set(prefixes)) / len(prefixes)
    aleatoric_scores["dup"] = dup_ratio
    details.append(f"{'✅' if dup_ratio < 0.2 else '⚠️'} 중복 {dup_ratio*100:.0f}%")

    short_ratio = sum(1 for n in news if len(n.title) < 15) / len(news)
    aleatoric_scores["short"] = short_ratio
    details.append(f"{'✅' if short_ratio < 0.1 else '⚠️'} 짧은제목 {short_ratio*100:.0f}%")

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


def _fetch_market_index() -> dict:
    """
    코스피/코스닥 지수 수집
    예측 보정에 활용 (시장 전체 트렌드 반영)
    """
    try:
        import math
        result = {}
        for name, ticker in [("kospi", "^KS11"), ("kosdaq", "^KQ11")]:
            hist = yf.Ticker(ticker).history(period="10d")
            if hist.empty:
                continue
            closes = [float(v) for v in hist["Close"].tolist() if not math.isnan(float(v))]
            if len(closes) >= 2:
                change_1d = (closes[-1] - closes[-2]) / closes[-2]
                change_5d = (closes[-1] - closes[-5]) / closes[-5] if len(closes) >= 5 else 0
                result[name] = {
                    "current": round(closes[-1], 2),
                    "change_1d": round(change_1d, 4),
                    "change_5d": round(change_5d, 4),
                    "trend": "상승" if change_5d > 0.01 else "하락" if change_5d < -0.01 else "보합",
                }
        print(f"📈 시장 지수 수집 완료: 코스피 {result.get('kospi', {}).get('current', '-')}")
        return result
    except Exception as e:
        print(f"⚠️ 시장 지수 수집 실패: {e}")
        return {}

def _calc_momentum_alpha(price_history: list[float]) -> float:
    """
    퀀트 방식 모멘텀 알파 팩터
    단기(5일) vs 장기(20일) 모멘텀 비교
    """
    if len(price_history) < 20:
        return 0.0

    current = price_history[-1]
    price_5d = price_history[-5]
    price_20d = price_history[-20]

    momentum_5d = (current - price_5d) / price_5d if price_5d > 0 else 0
    momentum_20d = (current - price_20d) / price_20d if price_20d > 0 else 0

    alpha = momentum_5d * 0.6 + momentum_20d * 0.4
    alpha = max(-1.0, min(1.0, alpha * 5))
    return round(alpha, 3)

def _calc_financial_alpha(financial) -> float:
    """
    퀀트 방식 재무 알파 팩터 계산
    PER, ROE, 부채비율, 성장률 기반
    """
    if not financial:
        return 0.0

    score = 0.0
    count = 0

    if financial.roe is not None:
        score += 1.0 if financial.roe > 0.1 else -0.5 if financial.roe < 0 else 0.0
        count += 1

    if financial.revenue_growth is not None:
        score += 1.0 if financial.revenue_growth > 0.1 else 0.3 if financial.revenue_growth > 0 else -0.5
        count += 1

    if financial.earnings_growth is not None:
        score += 1.0 if financial.earnings_growth > 0.1 else 0.3 if financial.earnings_growth > 0 else -0.5
        count += 1

    if financial.debt_to_equity is not None:
        score += 0.5 if financial.debt_to_equity < 50 else 0.0 if financial.debt_to_equity < 100 else -0.5
        count += 1

    if financial.operating_margin is not None:
        score += 1.0 if financial.operating_margin > 0.15 else 0.3 if financial.operating_margin > 0 else -0.5
        count += 1

    if count == 0:
        return 0.0

    alpha = max(-1.0, min(1.0, score / count))
    return round(alpha, 3)

def _calc_flow_alpha(
    institution: list[float],
    foreign: list[float],
    individual: list[float]
) -> float:
    """
    퀀트 방식 수급 알파 팩터 계산
    외국인/기관 순매수 트렌드 기반
    """
    if not institution or not foreign:
        return 0.0

    inst_3d = sum(institution[:3])
    foreign_3d = sum(foreign[:3])

    scale = 10_000_000

    inst_score = max(-1.0, min(1.0, inst_3d / scale))
    foreign_score = max(-1.0, min(1.0, foreign_3d / scale))

    flow_alpha = inst_score * 0.4 + foreign_score * 0.6

    return round(flow_alpha, 3)

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