import os
import pandas as pd
from collect_news import get_news_api  # 중복 제거: 뉴스 수집 로직 재사용


def get_and_save_news_api(keyword: str, file_name: str = "news_api_result.csv", days_ago: int = 7) -> None:
    """
    NewsAPI에서 뉴스를 수집하고 CSV로 저장합니다.

    Args:
        keyword: 검색 키워드
        file_name: 저장할 CSV 파일명
        days_ago: 최근 며칠 내 뉴스를 가져올지 (기본 7일)
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    absolute_file_path = os.path.join(current_dir, file_name)

    articles = get_news_api(keyword, days_ago=days_ago)

    if not articles:
        print(f"⚠️ '{keyword}'에 대한 검색 결과가 없습니다.")
        return

    news_data = [
        {
            "title": art.get("title"),
            "publisher": art.get("source", {}).get("name"),
            "link": art.get("url"),
            "time": art.get("publishedAt"),
            "description": art.get("description"),
        }
        for art in articles
    ]

    df = pd.DataFrame(news_data)

    # 중복 기사 제거
    df.drop_duplicates(subset=["title"], inplace=True)

    # UTF-8 BOM: Windows Excel 호환 필요 시 "utf-8-sig", 범용은 "utf-8"
    df.to_csv(absolute_file_path, index=False, encoding="utf-8-sig")

    print(f"🎉 [NewsAPI] '{keyword}' 뉴스 {len(df)}개 수집 성공!")
    print(f"👉 저장된 위치: {absolute_file_path}")


if __name__ == "__main__":
    print("NewsAPI 작동 테스트 시작...")
    get_and_save_news_api("SK Hynix")