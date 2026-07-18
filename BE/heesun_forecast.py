# =============================================================================
# heesun_forecast.py
# 예측 불확실성(Forecast Uncertainty) 계산 모듈 (거래량 반영 버전)
# =============================================================================

import yfinance as yf
import pandas as pd
import numpy as np
from prophet import Prophet
from datetime import datetime, timedelta


# -----------------------------------------------------------------------------
# 1단계: 주가 및 거래량 데이터 수집
# -----------------------------------------------------------------------------

def fetch_price_data(ticker: str, period_days: int = 365) -> pd.DataFrame:
    """
    yfinance로 주가와 거래량 데이터를 가져온다.
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

    # [수정] Close(y)와 함께 Volume 컬럼을 포함하여 가공합니다.
    df = raw[["Close", "Volume"]].reset_index()
    df.columns = ["ds", "y", "Volume"]
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.dropna()

    return df


# -----------------------------------------------------------------------------
# 2단계: Prophet으로 미래 주가 예측 (거래량 변수 추가)
# -----------------------------------------------------------------------------

def run_prophet_forecast(df: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """
    Prophet 모델에 거래량(Volume)을 추가 변수(Regressor)로 등록하여 예측한다.
    """
    # 1. 모델 정의 및 거래량 추가 변수 등록
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        interval_width=0.80,
        changepoint_prior_scale=0.05
    )
    
    # [추가] Prophet에 거래량을 외부 설명 변수로 추가합니다.
    model.add_regressor("Volume")

    # 모델 학습
    model.fit(df)
    
    # 2. 미래 예측용 시나리오 데이터프레임 생성
    future = model.make_future_dataframe(periods=forecast_days)
    
    # 과거 영역의 거래량 병합
    future = future.merge(df[["ds", "Volume"]], on="ds", how="left")
    
    # 3. [추가] 미래 7일간의 거래량 채우기
    # 미래 거래량은 알 수 없으므로, 가장 합리적인 '최근 5일간의 평균 거래량'을 가상 데이터로 주입합니다.
    recent_volume_avg = df["Volume"].tail(5).mean()
    future.loc[future["ds"] > df["ds"].max(), "Volume"] = recent_volume_avg

    # 예측 실행
    forecast = model.predict(future)

    return forecast


# -----------------------------------------------------------------------------
# 3단계: 예측 불확실성 점수 계산 (일자별) - 기존 로직 유지
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
    """
    today = pd.Timestamp.today().normalize()
    future_df = forecast[forecast["ds"] > today].head(forecast_days).reset_index(drop=True)

    if future_df.empty:
        # 혹시 오늘 날짜 기준 미래 데이터가 비어있다면 마지막 7일을 활용하는 안전 장치
        future_df = forecast.tail(forecast_days).reset_index(drop=True)

    # 과거 변동성
    past_df = forecast[forecast["ds"] <= today]

    if len(past_df) >= 10:
        daily_returns = past_df["yhat"].pct_change().dropna()
        volatility = daily_returns.std()
        VOLATILITY_MAX = 0.05
        volatility_score = max(0, (1 - volatility / VOLATILITY_MAX)) * 100
    else:
        volatility_score = 50

    daily_results = []

    for i, row in future_df.iterrows():
        day_num = i + 1

        width = row["yhat_upper"] - row["yhat_lower"]
        interval_ratio = width / current_price
        interval_score = _score_from_ratio(interval_ratio)

        # 날짜가 멀어질수록 변동성 페널티를 조금씩 더 반영
        recency_penalty = 1 - (day_num - 1) * 0.03
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
    print(f"[1/3] {ticker} 주가 및 거래량 데이터 수집 중...")
    df = fetch_price_data(ticker, period_days=365)

    current_price = float(df["y"].iloc[-1])
    data_period = len(df)

    print(f"[2/3] 거래량 반영 Prophet 예측 실행 중... (데이터: {data_period}일치, 현재가: {current_price:,.0f}원)")
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
# 5단계: 직접 실행 테스트
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    TEST_TICKER = "005930.KS"

    print("=" * 50)
    print(f"예측 분석 시작 (거래량 반영): {TEST_TICKER}")
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