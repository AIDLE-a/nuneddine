import os
import pandas as pd


def filter_news_by_title(
    input_file: str = "news_api_result.csv",
    output_file: str = "news_filtered_result.csv",
    keyword: str = "SK Hynix"
) -> None:
    """
    제목에 키워드가 포함된 기사만 필터링합니다.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(current_dir, input_file)
    output_path = os.path.join(current_dir, output_file)

    df = pd.read_csv(input_path)
    print(f"📂 총 {len(df)}개 기사 로드 완료.")

    df_filtered = df[df["title"].str.contains(keyword, case=False, na=False)]

    df_filtered.to_csv(output_path, index=False, encoding="utf-8-sig")

    print(f"✅ '{keyword}' 포함 기사: {len(df_filtered)}개 / 전체 {len(df)}개")
    print(f"👉 저장 위치: {output_path}")


if __name__ == "__main__":
    filter_news_by_title(
        input_file="news_api_result.csv",
        output_file="news_filtered_result.csv",
        keyword="SK Hynix"
    )