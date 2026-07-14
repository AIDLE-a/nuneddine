# =============================================================================
# heesun_forecast.py
# 예측 불확실성(Forecast Uncertainty) 계산 모듈 (1일 단위 세분화 버전)
#
# Prophet이 예측한 주가 범위(신뢰구간)가 얼마나 넓은지를 "일자별로" 보고
# "이 예측을 얼마나 믿을 수 있는가"를 0~100 점수로 반환한다.
#
#   - Prophet은 예측값(yhat)과 함께 상단(yhat_upper), 하단(yhat_lower)을 준다.
#   - 구간이 좁을수록 → 확신 높음 → 신뢰도 높음
#   - 구간이 넓을수록 → 모르겠다는 뜻 → 신뢰도 낮음
#   - 절대 금액이 아닌 현재가 대비 비율로 측정한다.
# =============================================================================

import yfinance as yf
import pandas as pd
import numpy as np
from prophet import Prophet
from datetime import datetime, timedelta


# -----------------------------------------------------------------------------
# 1단계: 주가 데이터 수집
# -----------------------------------------------------------------------------

def fetch_price_data(ticker: str, period_days: int = 365) -> pd.DataFrame:
    """
    yfinance로 주가 데이터를 가져온다.

    Args:
        ticker: 종목 코드. 한국 주식은 뒤에 .KS 붙임 (예: "005930.KS")
        period_days: 몇 일치 데이터를 가져올지 (기본 1년)

    Returns:
        날짜(ds)와 종가(y) 컬럼을 가진 DataFrame

    Raises:
        ValueError: 데이터가 너무 적거나 없을 때
    """
    end_date = datetime.today()
    start_date = end_date - timedelta(days=period_days)

    raw = yf.download(
        ticker,
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        progress=False
    )

    if raw.empty:
        raise ValueError(f"'{ticker}' 데이터를 가져올 수 없습니다. 종목 코드를 확인하세요.")

    if len(raw) < 30:
        raise ValueError(f"데이터가 {len(raw)}일치밖에 없습니다. 최소 30일 필요합니다.")

    df = raw[["Close"]].reset_index()
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.dropna()

    return df


# -----------------------------------------------------------------------------
# 2단계: Prophet으로 미래 주가 예측
# -----------------------------------------------------------------------------

def run_prophet_forecast(df: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """
    Prophet 모델로 미래 주가를 예측한다.

    Args:
        df: fetch_price_data()가 반환한 ds/y DataFrame
        forecast_days: 며칠 뒤까지 예측할지 (기본 7일)

    Returns:
        Prophet의 예측 결과 DataFrame
        주요 컬럼: ds, yhat, yhat_lower, yhat_upper
    """
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        interval_width=0.80,
        changepoint_prior_scale=0.05
    )

    model.fit(df)
    future = model.make_future_dataframe(periods=forecast_days)
    forecast = model.predict(future)

    return forecast


# -----------------------------------------------------------------------------
# 3단계: 예측 불확실성 점수 계산 (일자별)
# -----------------------------------------------------------------------------

def _score_from_ratio(interval_ratio: float, ratio_max: float = 0.30) -> int:
    """구간 너비 비율 → 0~100 점수. 좁을수록 고득점."""
    return int(max(0, (1 - interval_ratio / ratio_max)) * 100)


def calculate_daily_uncertainty(
    forecast: pd.DataFrame,
    current_price: float,
    forecast_days: int = 7
) -> list[dict]:
    """
    Prophet 예측 결과에서 '일자별' 불확실성 점수(0~100)를 계산한다.

    핵심 로직 (하루 단위로 반복 적용):
      1. 해당 날짜의 신뢰구간 너비를 구한다 (yhat_upper - yhat_lower)
      2. 현재 주가 대비 비율로 변환한다
      3. 비율을 0~100 점수로 변환한다 (좁을수록 높은 점수)
      4. 과거 변동성(표준편차)은 전체 기간 공통값으로 계산 후,
         날짜가 멀어질수록 페널티를 조금씩 더 반영해 가중 평균

    Args:
        forecast: run_prophet_forecast()가 반환한 DataFrame
        current_price: 현재 주가
        forecast_days: 분석할 미래 일수

    Returns:
        [
            {
                "day": 1,
                "date": "2026-07-15",
                "predicted_price": float,
                "lower_bound": float,
                "upper_bound": float,
                "interval_ratio": float,
                "confidence_score": int,
                "warnings": list[str]
            },
            ...  # day forecast_days 까지
        ]
    """
    today = pd.Timestamp.today().normalize()
    future_df = forecast[forecast["ds"] > today].head(forecast_days).reset_index(drop=True)

    if future_df.empty:
        raise ValueError("미래 예측 데이터가 없습니다.")

    # 과거 변동성 (공통값으로 계산 후 일자별 가중치만 다르게 적용)
    past_df = forecast[forecast["ds"] <= today]

    if len(past_df) >= 10:
        daily_returns = past_df["yhat"].pct_change().dropna()
        volatility = daily_returns.std()
        VOLATILITY_MAX = 0.05
        volatility_score = max(0, (1 - volatility / VOLATILITY_MAX)) * 100
    else:
        volatility_score = 50  # 데이터 부족 시 중간값

    daily_results = []

    for i, row in future_df.iterrows():
        day_num = i + 1

        width = row["yhat_upper"] - row["yhat_lower"]
        interval_ratio = width / current_price
        interval_score = _score_from_ratio(interval_ratio)

        # 날짜가 멀어질수록 변동성 페널티를 조금씩 더 반영
        recency_penalty = 1 - (day_num - 1) * 0.03  # day1: 1.0, day7: 0.82
        adj_volatility_score = volatility_score * recency_penalty

        final_score = int(interval_score * 0.70 + adj_volatility_score * 0.30)

        day_warnings = []
        if interval_ratio > 0.20:
            day_warnings.append(f"D+{day_num} 예측 구간이 현재가의 {interval_ratio*100:.1f}%로 매우 넓음")
        elif interval_ratio > 0.10:
            day_warnings.append(f"D+{day_num} 예측 구간이 현재가의 {interval_ratio*100:.1f}%로 불확실성 존재")

        if final_score < 40:
            day_warnings.append(f"D+{day_num} 예측 불확실성 높음")

        daily_results.append({
            "day": day_num,
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted_price": round(float(row["yhat"]), 0),
            "lower_bound": round(float(row["yhat_lower"]), 0),
            "upper_bound": round(float(row["yhat_upper"]), 0),
            "interval_ratio": round(float(interval_ratio), 4),
            "confidence_score": final_score,
            "warnings": day_warnings,
        })

    return daily_results


# -----------------------------------------------------------------------------
# 4단계: 전체 파이프라인 실행 함수
# -----------------------------------------------------------------------------

def run_forecast_uncertainty(ticker: str, forecast_days: int = 7) -> dict:
    """
    ticker 하나를 받아서 예측 불확실성 분석 전체를 실행한다.
    FastAPI 노드에서 이 함수 하나만 호출하면 된다.

    Args:
        ticker: 종목 코드 (예: "005930.KS")
        forecast_days: 예측 기간 (기본 7일)

    Returns:
        {
            "ticker": str,
            "current_price": float,
            "data_period_days": int,
            "forecast_days": int,
            "daily": list[dict],       # day 1~forecast_days 예측
            "warnings": list[str],     # 종목 레벨 경고
        }
    """
    print(f"[1/3] {ticker} 주가 데이터 수집 중...")
    df = fetch_price_data(ticker, period_days=365)

    current_price = float(df["y"].iloc[-1])
    data_period = len(df)

    print(f"[2/3] Prophet 예측 실행 중... (데이터: {data_period}일치, 현재가: {current_price:,.0f}원)")
    forecast = run_prophet_forecast(df, forecast_days=forecast_days)

    print(f"[3/3] 일자별 불확실성 점수 계산 중...")
    daily = calculate_daily_uncertainty(forecast, current_price, forecast_days)

    overall_warnings = []
    if data_period < 90:
        overall_warnings.append(f"학습 데이터가 {data_period}일치로 부족 (권장: 90일 이상)")

    last_day = daily[-1]
    if last_day["confidence_score"] < 40:
        overall_warnings.append("7일 후 예측 불확실성 높음 — 추가 검토 권장")

    return {
        "ticker": ticker,
        "current_price": current_price,
        "data_period_days": data_period,
        "forecast_days": forecast_days,
        "daily": daily,
        "warnings": overall_warnings,
    }


# -----------------------------------------------------------------------------
# 5단계: 직접 실행 테스트 (python heesun_forecast.py 로 실행)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    TEST_TICKER = "005930.KS"

    print("=" * 50)
    print(f"예측 불확실성 분석 시작: {TEST_TICKER}")
    print("=" * 50)

    result = run_forecast_uncertainty(TEST_TICKER, forecast_days=7)

    print(f"\n현재가: {result['current_price']:,.0f}원")
    print(f"학습 데이터: {result['data_period_days']}일치\n")

    print("[일자별 예측]")
    for d in result["daily"]:
        print(
            f"  D+{d['day']} ({d['date']}): "
            f"{d['predicted_price']:,.0f}원  "
            f"[{d['lower_bound']:,.0f} ~ {d['upper_bound']:,.0f}]  "
            f"신뢰도 {d['confidence_score']}점"
        )
        for w in d["warnings"]:
            print(f"     ⚠ {w}")

    if result["warnings"]:
        print("\n[종목 레벨 경고]")
        for w in result["warnings"]:
            print(f"  ⚠ {w}")
    else:
        print("\n[경고 없음] 예측 신뢰도 양호")