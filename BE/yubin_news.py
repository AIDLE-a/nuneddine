import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote
from datetime import datetime

# 주요 종목 코드 매핑
STOCK_NAME_MAP = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
    "035720": "카카오",
    "066570": "LG전자",
    "005380": "현대차",
    "000270": "기아",
    "373220": "LG에너지솔루션",
    "207940": "삼성바이오로직스",
    "005490": "POSCO홀딩스",
}


def get_news_api(keyword: str):
    """
    개수 제한 없이 해당 종목과 관련된 최신 뉴스 기사를 모두 수집합니다.
    """
    clean_keyword = keyword.split(".")[0]
    search_keyword = STOCK_NAME_MAP.get(clean_keyword, clean_keyword)

    # 관련도 높은 다각도 검색 키워드 구성
    search_queries = [
        f"{search_keyword}",
        f"{search_keyword} 주가",
        f"{search_keyword} 주식",
        f"{search_keyword} 실적",
        f"{search_keyword} 공시",
        f"{search_keyword} 목표가",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
    }

    news_list = []
    seen_titles = set()  # 중복 기사 필터링용

    for query in search_queries:
        encoded_query = quote(query)
        # when:7d -> 최근 7일 내의 관련 기사 전체
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}+when:7d&hl=ko&gl=KR&ceid=KR:ko"

        try:
            response = requests.get(rss_url, headers=headers, timeout=10)
            if response.status_code == 200:
                root = ET.fromstring(response.content)

                # 슬라이싱([:N])을 제거하여 검색된 모든 item을 수집
                for item in root.findall(".//item"):
                    title = (
                        item.find("title").text
                        if item.find("title") is not None
                        else ""
                    )

                    # 제목 중복 제거 (여러 키워드로 수집하므로 중복 방지 필수)
                    if not title or title in seen_titles:
                        continue
                    seen_titles.add(title)

                    link = (
                        item.find("link").text
                        if item.find("link") is not None
                        else ""
                    )
                    pub_date = (
                        item.find("pubDate").text
                        if item.find("pubDate") is not None
                        else ""
                    )

                    source_name = "네이버뉴스"
                    if " - " in title:
                        parts = title.rsplit(" - ", 1)
                        title = parts[0]
                        source_name = parts[1]

                    news_list.append(
                        {
                            "title": title,
                            "source": source_name,
                            "publisher": source_name,
                            "link": link,
                            "url": link,
                            "published_at": pub_date,
                            "description": title,
                        }
                    )
        except Exception as e:
            print(f"⚠️ RSS 뉴스 수집 오류 ({query}): {e}")

    print(f"📊 [{search_keyword}] 총 수집된 관련 기사 수: {len(news_list)}건")
    return news_list