import requests
from config import NEWS_API_KEY


def get_news_api(keyword: str, days_ago: int = 7, max_results: int = 100) -> list[dict]:
    """
    NewsAPI에서 뉴스 기사를 가져와 리스트로 반환합니다.

    Args:
        keyword: 검색 키워드
        days_ago: 최근 며칠 내 뉴스를 가져올지 (기본 7일)
        max_results: 최대 수집 기사 수 (기본 100, 무료 플랜 상한)

    Returns:
        기사 딕셔너리 리스트
    """
    from datetime import datetime, timedelta

    from_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": keyword,
        "apiKey": NEWS_API_KEY,
        "language": "en",
        "sortBy": "publishedAt",
        "from": from_date,
        "pageSize": min(max_results, 100),  # 무료 플랜 최대 100건
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json().get("articles", [])

    except requests.exceptions.Timeout:
        print("❌ 요청 시간 초과 (timeout)")
        return []
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP 에러: {e.response.status_code} - {e.response.json().get('message', '')}")
        return []
    except requests.exceptions.RequestException as e:
        print(f"❌ 네트워크 오류: {e}")
        return []


if __name__ == "__main__":
    test_articles = get_news_api("SK Hynix")
    print(f"NewsAPI 뉴스 개수: {len(test_articles)}개 수집 완료!")