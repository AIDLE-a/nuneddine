##cd ~/Desktop/stock-research-agent
##source venv/bin/activate

# =============================================================================
# forecast_uncertainty.py
# 예측 불확실성(Forecast Uncertainty) 계산 모듈
#
# Prophet이 예측한 주가 범위(신뢰구간)가 얼마나 넓은지를 보고 "이 예측을 얼마나 믿을 수 있는가"를 0~100 점수로 반환한다.

#   - Prophet은 예측값(yhat)과 함께 상단(yhat_upper), 하단(yhat_lower)을 준다.
#   - 구간이 좁을수록 → 확신 높음 → 신뢰도 높음
#   - 구간이 넓을수록 → 모르겠다는 뜻 → 신뢰도 낮음
#   - 절대 금액이 아닌 현재가 대비 비율로 측정한다.
#     (5만원 주식의 1만원 구간 vs 50만원 주식의 1만원 구간은 의미가 다름)
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
        Prophet은 반드시 'ds'(날짜), 'y'(값) 컬럼명을 요구함

    Raises:
        ValueError: 데이터가 너무 적거나 없을 때
    """
    end_date = datetime.today()
    start_date = end_date - timedelta(days=period_days)

    # yfinance로 데이터 다운로드
    raw = yf.download(
        ticker,
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        progress=False  # 터미널 출력 숨김
    )

    if raw.empty:
        raise ValueError(f"'{ticker}' 데이터를 가져올 수 없습니다. 종목 코드를 확인하세요.")

    if len(raw) < 30:
        raise ValueError(f"데이터가 {len(raw)}일치밖에 없습니다. 최소 30일 필요합니다.")

    # Prophet 형식으로 변환: 날짜 → ds, 종가 → y
    df = raw[["Close"]].reset_index()
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])

    # 결측값 제거 (공휴일 등으로 빈 날 있을 수 있음)
    df = df.dropna()

    return df


# -----------------------------------------------------------------------------
# 2단계: Prophet으로 미래 주가 예측
# -----------------------------------------------------------------------------

def run_prophet_forecast(df: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """
    Prophet 모델로 미래 주가를 예측한다.

    Prophet은 Meta(구 Facebook)가 만든 시계열 예측 라이브러리로,
    계절성(주별, 연별 패턴)과 추세를 자동으로 학습한다.

    Args:
        df: fetch_price_data()가 반환한 ds/y DataFrame
        forecast_days: 며칠 뒤까지 예측할지 (기본 7일)

    Returns:
        Prophet의 예측 결과 DataFrame
        주요 컬럼:
          - ds: 날짜
          - yhat: 예측값 (중앙값)
          - yhat_lower: 신뢰구간 하단 (기본 80% 신뢰구간)
          - yhat_upper: 신뢰구간 상단
    """
    model = Prophet(
        daily_seasonality=False,   # 일별 패턴은 주식에 의미없음
        weekly_seasonality=True,   # 주중/주말 패턴 학습
        yearly_seasonality=True,   # 연간 패턴 학습
        interval_width=0.80,       # 80% 신뢰구간 (68%도 가능, 넓을수록 보수적)
        changepoint_prior_scale=0.05  # 추세 변화 민감도 (낮을수록 안정적)
    )

    # 모델 학습 (과거 데이터 fitting)
    model.fit(df)

    # 미래 날짜 생성 (주말 포함)
    future = model.make_future_dataframe(periods=forecast_days)

    # 예측 실행
    forecast = model.predict(future)

    return forecast


# -----------------------------------------------------------------------------
# 3단계: 예측 불확실성 점수 계산
# -----------------------------------------------------------------------------

def calculate_forecast_uncertainty(
    forecast: pd.DataFrame,
    current_price: float,
    forecast_days: int = 7
) -> dict:
    """
    Prophet 예측 결과에서 불확실성 점수(0~100)를 계산한다.

    핵심 로직:
      1. 미래 구간의 신뢰구간 너비를 구한다 (upper - lower)
      2. 현재 주가 대비 비율로 변환한다 (상대적 크기가 중요)
      3. 비율을 0~100 점수로 변환한다 (좁을수록 높은 점수)
      4. 추가로 최근 변동성(표준편차)도 반영한다

    Args:
        forecast: run_prophet_forecast()가 반환한 DataFrame
        current_price: 현재 주가 (구간 너비를 상대적으로 측정하기 위해 필요)
        forecast_days: 분석할 미래 일수

    Returns:
        {
            "confidence_score": int,      # 0~100 신뢰도 점수
            "interval_ratio": float,      # 신뢰구간 너비 / 현재가 비율
            "predicted_price": float,     # 예측 중앙값 (7일 후)
            "lower_bound": float,         # 신뢰구간 하단
            "upper_bound": float,         # 신뢰구간 상단
            "volatility_score": int,      # 변동성 기반 보조 점수
            "warnings": list[str]         # 경고 메시지 목록
        }
    """
    warnings = []

    # 미래 구간만 추출 (오늘 이후 forecast_days일)
    today = pd.Timestamp.today().normalize()
    future_df = forecast[forecast["ds"] > today].head(forecast_days)

    if future_df.empty:
        raise ValueError("미래 예측 데이터가 없습니다.")

    # -------------------------------------------------------------------------
    # [핵심 계산 1] 신뢰구간 너비 비율
    # -------------------------------------------------------------------------
    # 미래 7일의 평균 신뢰구간 너비 계산
    avg_upper = future_df["yhat_upper"].mean()
    avg_lower = future_df["yhat_lower"].mean()
    avg_width = avg_upper - avg_lower

    # 현재가 대비 비율 (예: 0.12 = 현재가의 12%)
    interval_ratio = avg_width / current_price

    # 비율 → 점수 변환
    # 기준: 5% 이내 → 만점(100), 30% 이상 → 0점
    # 선형 보간: score = (1 - ratio/0.30) * 100
    RATIO_MAX = 0.30  # 30% 초과면 완전 불확실
    interval_score = max(0, (1 - interval_ratio / RATIO_MAX)) * 100

    # -------------------------------------------------------------------------
    # [핵심 계산 2] 최근 변동성 (보조 지표)
    # -------------------------------------------------------------------------
    # 과거 데이터에서 일별 등락률의 표준편차를 구한다
    # 변동성이 크면 Prophet 자체가 학습하기 어렵고 예측도 믿기 어렵다
    past_df = forecast[forecast["ds"] <= today]

    if len(past_df) >= 10:
        # 일별 변화율 계산 (예: 0.02 = 2% 등락)
        daily_returns = past_df["yhat"].pct_change().dropna()
        volatility = daily_returns.std()  # 표준편차

        # 변동성 → 점수 변환
        # 기준: 1% 이내 → 안정(100점), 5% 이상 → 불안정(0점)
        VOLATILITY_MAX = 0.05
        volatility_score = max(0, (1 - volatility / VOLATILITY_MAX)) * 100
    else:
        volatility_score = 50  # 데이터 부족 시 중간값
        warnings.append("과거 데이터 부족으로 변동성 계산 불가")

    # -------------------------------------------------------------------------
    # [최종 점수] 구간 너비(70%) + 변동성(30%) 가중 평균
    # -------------------------------------------------------------------------
    final_score = int(interval_score * 0.70 + volatility_score * 0.30)

    # -------------------------------------------------------------------------
    # [경고 생성] 임계값 초과 시 경고 메시지 추가
    # -------------------------------------------------------------------------
    if interval_ratio > 0.20:
        # 신뢰구간이 현재가의 20% 초과 → 매우 넓은 구간
        warnings.append(f"예측 구간이 현재가의 {interval_ratio*100:.1f}%로 변동성 매우 높음")

    elif interval_ratio > 0.10:
        # 10~20% → 주의 수준
        warnings.append(f"예측 구간이 현재가의 {interval_ratio*100:.1f}%로 불확실성 존재")

    if volatility_score < 40:
        warnings.append("최근 주가 변동성이 높아 예측 신뢰도 낮음")

    if final_score < 40:
        warnings.append("예측 불확실성 높음 — 추가 검토 권장")

    # -------------------------------------------------------------------------
    # [결과 반환]
    # -------------------------------------------------------------------------
    # 7일 후 예측값 (마지막 날 기준)
    last_forecast = future_df.iloc[-1]

    return {
        "confidence_score": final_score,          # 종합 신뢰도 점수
        "interval_ratio": round(interval_ratio, 4),  # 구간 너비 비율
        "predicted_price": round(float(last_forecast["yhat"]), 0),
        "lower_bound": round(float(last_forecast["yhat_lower"]), 0),
        "upper_bound": round(float(last_forecast["yhat_upper"]), 0),
        "volatility_score": int(volatility_score),
        "warnings": warnings
    }


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
        calculate_forecast_uncertainty()의 결과 dict +
        ticker, current_price, data_period 추가
    """
    print(f"[1/3] {ticker} 주가 데이터 수집 중...")
    df = fetch_price_data(ticker, period_days=365)

    # 현재가 = 가장 최근 종가
    current_price = float(df["y"].iloc[-1])
    data_period = len(df)  # 실제 수집된 거래일 수

    print(f"[2/3] Prophet 예측 실행 중... (데이터: {data_period}일치, 현재가: {current_price:,.0f}원)")
    forecast = run_prophet_forecast(df, forecast_days=forecast_days)

    print(f"[3/3] 불확실성 점수 계산 중...")
    result = calculate_forecast_uncertainty(forecast, current_price, forecast_days)

    # 추가 메타 정보 붙이기
    result["ticker"] = ticker
    result["current_price"] = current_price
    result["data_period_days"] = data_period
    result["forecast_days"] = forecast_days

    # 데이터 기간이 짧으면 경고 추가
    if data_period < 90:
        result["warnings"].append(f"학습 데이터가 {data_period}일치로 부족 (권장: 90일 이상)")

    return result


# -----------------------------------------------------------------------------
# 5단계: 직접 실행 테스트 (python forecast_uncertainty.py 로 실행)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    # 삼성전자로 테스트
    TEST_TICKER = "005930.KS"

    print("=" * 50)
    print(f"예측 불확실성 분석 시작: {TEST_TICKER}")
    print("=" * 50)

    result = run_forecast_uncertainty(TEST_TICKER, forecast_days=7)

    print("\n[분석 결과]")
    print(f"  현재가:       {result['current_price']:,.0f}원")
    print(f"  7일 후 예측:  {result['predicted_price']:,.0f}원")
    print(f"  예측 구간:    {result['lower_bound']:,.0f}원 ~ {result['upper_bound']:,.0f}원")
    print(f"  구간 비율:    현재가의 {result['interval_ratio']*100:.1f}%")
    print(f"  변동성 점수:  {result['volatility_score']}점")
    print(f"  최종 신뢰도:  {result['confidence_score']}점 / 100점")

    if result["warnings"]:
        print("\n[경고]")
        for w in result["warnings"]:
            print(f"  ⚠ {w}")
    else:
        print("\n[경고 없음] 예측 신뢰도 양호")
