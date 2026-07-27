"""
[3단계: Prophet 기반 주가 예측 & 거래량 분석 레이어 — 담당: 희선]

1. yfinance 안전 파싱 (MultiIndex 완벽 대응)
2. Prophet + Volume Regressor (거래량 반영 시계열 예측)
3. 2단계 감성 점수(Sentiment) 결합 휴리스틱 보정
4. 일자별 예측 불확실성(Uncertainty Score) & 거래량 분석 생성
"""

import os
import time
import math
from datetime import datetime, timedelta, timezone
import pandas as pd
import numpy as np
import yfinance as yf
from prophet import Prophet

from schemas import Prediction, PredictionResult, Sentiment

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
SENTIMENT_ADJUSTMENT_WEIGHT = 0.02
FORECAST_DAYS = 7

# 종목별 Prophet 결과 캐시 (1시간 유효)
_cache: dict = {}
_CACHE_TTL = 3600


# ==========================================
# 1. 메인 인터페이스 (오케스트레이터 호출용)
# ==========================================

def predict(
    ticker: str,
    price: float,
    sentiment: Sentiment,
    market_index: dict = None,
    target_mean_price: float = None,
) -> PredictionResult:
    """오케스트레이터가 호출하는 최상위 예측 함수"""
    if USE_MOCK:
        base = _get_mock_prediction(price)
        volume_history = [1200000, 1500000, 900000, 1100000, 1300000, 2100000, 1800000]
        volume_analysis = _analyze_volume(volume_history)
    else:
        base = _run_prophet(ticker, price)
        volume_history = _get_actual_volume_history(ticker)
        volume_analysis = _analyze_volume(volume_history)

    # 2단계 감성 분석 결과(Sentiment)로 예측치 보정
    adjusted = [_adjust_with_sentiment(day, sentiment) for day in base]

    # 코스피/코스닥 시장 트렌드 보정
    if market_index:
        adjusted = [_adjust_with_market(day, market_index, ticker) for day in adjusted]
        if ticker.endswith(".KQ"):
            print(f"📈 코스닥 보정 적용: {market_index.get('kosdaq', {}).get('trend', '-')}")
        else:
            print(f"📈 코스피 보정 적용: {market_index.get('kospi', {}).get('trend', '-')}")

    # 증권사 목표주가 보정
    if target_mean_price and price:
        adjusted = [_adjust_with_analyst_target(day, price, target_mean_price) for day in adjusted]
        upside = (target_mean_price - price) / price * 100
        print(f"🎯 증권사 목표주가 보정 적용: 업사이드 {upside:.1f}%")

    prediction_warning = _check_prediction_uncertainty(adjusted)

    return PredictionResult(
        prediction=adjusted,
        prediction_warning=prediction_warning,
        volume_history=volume_history,
        volume_analysis=volume_analysis
    )


# ==========================================
# 2. Prophet 실행 및 보정 로직
# ==========================================

def _run_prophet(ticker: str, price: float) -> list[Prediction]:
    """캐시 적용 및 Prophet 모델 연동"""
    cached = _cache.get(ticker)
    if cached and time.time() - cached["ts"] < _CACHE_TTL:
        print(f"⚡ [{ticker}] Prophet 예측 캐시 사용")
        return cached["predictions"]

    try:
        result = run_forecast_pipeline(ticker, forecast_days=FORECAST_DAYS)
        predictions = [
            Prediction(
                day=row["day"],
                future_price=row["predicted_price"],
                lower=row["lower_bound"],
                upper=row["upper_bound"],
                confidence_score=row["confidence_score"],
            )
            for row in result["daily"]
        ]
    except Exception as e:
        print(f"⚠️ Prophet 예측 실패 ({ticker}): {e} -> Mock 데이터로 대체합니다.")
        predictions = _get_mock_prediction(price)

    _cache[ticker] = {"predictions": predictions, "ts": time.time()}
    return predictions



def _adjust_with_market(prediction: Prediction, market_index: dict, ticker: str = "") -> Prediction:
    """
    코스피/코스닥 시장 트렌드로 예측치 보정
    - 코스피 종목(.KS): 코스피 지수 반영
    - 코스닥 종목(.KQ): 코스닥 지수 반영
    """
    # 종목에 맞는 지수 선택
    if ticker.endswith(".KQ"):
        index = market_index.get("kosdaq", {})
        index_name = "코스닥"
    else:
        index = market_index.get("kospi", {})
        index_name = "코스피"

    change_5d = index.get("change_5d", 0)

    # 5일 시장 변화율의 30%만 반영 (과도한 보정 방지)
    market_adjustment = 1 + (change_5d * 0.3)
    market_adjustment = max(0.98, min(1.02, market_adjustment))  # ±2% 제한

    return Prediction(
        day=prediction.day,
        future_price=round(prediction.future_price * market_adjustment, 1),
        lower=round(prediction.lower * market_adjustment, 1),
        upper=round(prediction.upper * market_adjustment, 1),
        confidence_score=prediction.confidence_score,
    )


def _adjust_with_analyst_target(
    prediction: Prediction,
    current_price: float,
    target_mean_price: float,
) -> Prediction:
    """
    증권사 평균 목표주가로 예측치 보정
    목표주가 방향으로 약하게 수렴하는 보정
    """
    if current_price <= 0 or target_mean_price <= 0:
        return prediction

    upside = (target_mean_price - current_price) / current_price
    # 단기(7일) 예측이므로 목표주가의 3%만 반영
    analyst_adjustment = 1 + (upside * 0.03)
    analyst_adjustment = max(0.99, min(1.01, analyst_adjustment))  # ±1% 제한

    return Prediction(
        day=prediction.day,
        future_price=round(prediction.future_price * analyst_adjustment, 1),
        lower=round(prediction.lower * analyst_adjustment, 1),
        upper=round(prediction.upper * analyst_adjustment, 1),
        confidence_score=prediction.confidence_score,
    )

def _adjust_with_sentiment(prediction: Prediction, sentiment: Sentiment) -> Prediction:
    """감성 점수(Positive - Negative)로 7일간 주가 예측치 보정"""
    sentiment_score = sentiment.positive - sentiment.negative
    adjustment = 1 + (sentiment_score * SENTIMENT_ADJUSTMENT_WEIGHT)
    
    return Prediction(
        day=prediction.day,
        future_price=round(prediction.future_price * adjustment, 1),
        lower=round(prediction.lower * adjustment, 1),
        upper=round(prediction.upper * adjustment, 1),
        confidence_score=prediction.confidence_score,
    )


def _check_prediction_uncertainty(predictions: list[Prediction]) -> str | None:
    """예측 구간(upper - lower)이 상단가 대비 10% 이상 넓어지면 변동성 경고 발생"""
    for p in predictions:
        spread = p.upper - p.lower
        if p.future_price > 0 and (spread / p.future_price) > 0.1:
            return "변동성 높음"
    return None


def _get_mock_prediction(price: float) -> list[Prediction]:
    """Mock 데이터 반환용"""
    predictions = []
    for day in range(1, FORECAST_DAYS + 1):
        future_price = price * (1 + 0.015 * day / FORECAST_DAYS)
        spread_ratio = 0.01 + 0.005 * day
        predictions.append(
            Prediction(
                day=day,
                future_price=round(future_price, 1),
                lower=round(future_price * (1 - spread_ratio), 1),
                upper=round(future_price * (1 + spread_ratio), 1),
                confidence_score=max(30, 100 - day * 8),
            )
        )
    return predictions


# ==========================================
# 3. 거래량 수집 및 리포트 분석 로직
# ==========================================

def _get_actual_volume_history(ticker: str) -> list[int]:
    """최근 7영업일의 거래량 수집 (yfinance Safe Extraction)"""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1mo")
        if not hist.empty and "Volume" in hist.columns:
            volumes = hist["Volume"].dropna().tail(7).tolist()
            return [int(v) for v in volumes]
    except Exception as e:
        print(f"❌ 거래량 수집 실패 ({ticker}): {e}")
    
    return [0, 0, 0, 0, 0, 0, 0]


def _analyze_volume(volume_history: list[int]) -> str:
    """거래량 변화율 계산 및 자연어 분석 문장 생성"""
    clean_vols = [v for v in volume_history if v > 0]
    if len(clean_vols) < 2:
        return "최근 거래량 데이터가 충분하지 않아 분석이 제한적입니다."

    yesterday_vol = clean_vols[-1]
    prev_avg_vol = sum(clean_vols[:-1]) / len(clean_vols[:-1])

    if prev_avg_vol == 0:
        return "거래량 데이터가 부족하여 흐름 분석을 건너뜁니다."

    increase_rate = ((yesterday_vol - prev_avg_vol) / prev_avg_vol) * 100

    if increase_rate >= 50:
        return f"최근 거래량이 이전 평균 대비 {increase_rate:.1f}% 급증하여 시장 관심이 크게 유입되고 있습니다. 가격 변동성 확대에 유의하세요."
    elif increase_rate <= -30:
        return f"최근 거래량이 이전 평균 대비 {abs(increase_rate):.1f}% 감소하여 관망세가 짙어지고 있습니다. 단기 횡보 가능성이 높습니다."
    else:
        return "최근 거래량이 평소 수준을 유지를 하고 있어 수급 불균형 없이 안정적인 거래 흐름을 보이고 있습니다."


# ==========================================
# 4. Prophet 시계열 엔진 (MultiIndex 파싱 보완)
# ==========================================

def fetch_price_data(ticker: str, period_days: int = 365) -> pd.DataFrame:
    """yfinance 수집 및 데이터프레임 안전 파싱"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_days)

    raw = yf.download(
        ticker,
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        progress=False
    )

    if raw.empty:
        raise ValueError(f"'{ticker}' 주가 데이터를 가져올 수 없습니다.")

    # MultiIndex 컬럼일 경우 Single Level로 단일화
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    if "Close" not in raw.columns or "Volume" not in raw.columns:
        raise ValueError(f"'{ticker}' 필수 데이터(Close, Volume)가 누락되었습니다.")

    df = raw[["Close", "Volume"]].reset_index()
    df.columns = ["ds", "y", "Volume"]
    df["ds"] = pd.to_datetime(df["ds"]).dt.tz_localize(None)
    
    # NaN 및 0 이하 값 처리
    df["y"] = df["y"].ffill().bfill()
    df["Volume"] = df["Volume"].replace(0, np.nan).ffill().bfill()
    df = df.dropna()

    if len(df) < 30:
        raise ValueError(f"학습용 데이터가 {len(df)}건으로 부족합니다. (최소 30건 필요)")

    return df


def run_prophet_forecast(df: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """Prophet + Volume Regressor 학습 및 미래 7일 예측"""
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        interval_width=0.85,          # 신뢰구간 85%로 확대 (보수적)
        changepoint_prior_scale=0.03, # 변동점 민감도 낮춤 (과적합 방지)
        seasonality_prior_scale=10,   # 계절성 강도
        holidays_prior_scale=10,      # 공휴일 효과
    )

    # 한국 공휴일 추가
    try:
        import pandas as pd
        kr_holidays = pd.DataFrame({
            "holiday": "kr_holiday",
            "ds": pd.to_datetime([
                "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30",
                "2025-03-01", "2025-05-05", "2025-05-06", "2025-06-06",
                "2025-08-15", "2025-10-03", "2025-10-05", "2025-10-06",
                "2025-10-07", "2025-10-08", "2025-10-09", "2025-12-25",
                "2026-01-01", "2026-01-28", "2026-01-29", "2026-01-30",
                "2026-03-01", "2026-05-05", "2026-06-06", "2026-08-15",
            ]),
            "lower_window": 0,
            "upper_window": 1,
        })
        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
            interval_width=0.85,
            changepoint_prior_scale=0.03,
            seasonality_prior_scale=10,
            holidays_prior_scale=10,
            holidays=kr_holidays,
        )
    except:
        pass
    
    # 거래량을 외생 변수로 등록
    model.add_regressor("Volume")
    model.fit(df)
    
    # 미래 예측 프레임 생성
    future = model.make_future_dataframe(periods=forecast_days)
    future = future.merge(df[["ds", "Volume"]], on="ds", how="left")
    
    # 미래 7일 거래량은 최근 5일 평균값으로 보정
    recent_vol_avg = df["Volume"].tail(5).mean()
    future["Volume"] = future["Volume"].fillna(recent_vol_avg)

    forecast = model.predict(future)
    return forecast


def calculate_daily_uncertainty(
    forecast: pd.DataFrame,
    current_price: float,
    forecast_days: int = 7
) -> list[dict]:
    """일자별 예측 불확실성 및 신뢰도 점수(0~100) 계산"""
    # 미래 forecast_days 항목 추출
    future_df = forecast.tail(forecast_days).reset_index(drop=True)
    past_df = forecast.iloc[:-forecast_days]

    # 과거 변동성 계산
    if len(past_df) >= 10:
        daily_returns = past_df["yhat"].pct_change().dropna()
        volatility = daily_returns.std() if not daily_returns.empty else 0.02
        volatility_score = max(0, (1 - volatility / 0.05)) * 100
    else:
        volatility_score = 50.0

    daily_results = []
    for i, row in future_df.iterrows():
        day_num = i + 1
        width = row["yhat_upper"] - row["yhat_lower"]
        interval_ratio = width / current_price if current_price > 0 else 0.2

        # 구간이 좁을수록 높은 점수
        interval_score = max(0, (1 - interval_ratio / 0.30)) * 100
        recency_penalty = 1 - ((day_num - 1) * 0.04)  # 날짜 멀수록 더 많이 패널티
        adj_vol_score = volatility_score * recency_penalty

        # 가격 방향성 점수 추가
        price_direction = row["yhat"] - current_price
        direction_score = min(10, abs(price_direction / current_price) * 100)

        final_score = int(interval_score * 0.60 + adj_vol_score * 0.30 + direction_score * 0.10)
        final_score = max(10, min(99, final_score))  # 10~99점 제약

        daily_results.append({
            "day": day_num,
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted_price": round(float(row["yhat"]), 1),
            "lower_bound": round(float(row["yhat_lower"]), 1),
            "upper_bound": round(float(row["upper_bound"] if "upper_bound" in row else row["yhat_upper"]), 1),
            "confidence_score": final_score,
        })

    return daily_results


def run_forecast_pipeline(ticker: str, forecast_days: int = 7) -> dict:
    """전체 Prophet 파이프라인 처리"""
    df = fetch_price_data(ticker, period_days=365)  # 1년 데이터
    current_price = float(df["y"].iloc[-1])
    
    forecast = run_prophet_forecast(df, forecast_days=forecast_days)
    daily = calculate_daily_uncertainty(forecast, current_price, forecast_days)

    return {
        "ticker": ticker,
        "current_price": current_price,
        "daily": daily,
    }


# ==========================================
# 5. 셀프 테스트 실행
# ==========================================


def predict_until_date(ticker: str, target_date: str) -> dict:
    """
    특정 날짜까지 예측
    target_date: YYYY-MM-DD 형식
    """
    try:
        from datetime import datetime
        target = datetime.strptime(target_date, "%Y-%m-%d")
        today = datetime.now()
        days_diff = (target - today).days

        if days_diff < 0:
            return {"error": "과거 날짜는 예측할 수 없어요. 오늘 이후 날짜를 선택해주세요."}
        if days_diff > 365:
            return {"error": "1년 이내의 날짜만 예측 가능해요."}

        # Prophet 예측 실행
        df = fetch_price_data(ticker, period_days=365)
        current_price = float(df["y"].iloc[-1])
        forecast = run_prophet_forecast(df, forecast_days=days_diff)

        # 해당 날짜 예측값 추출
        future_df = forecast.tail(max(days_diff, 1)).reset_index(drop=True)
        if future_df.empty:
            return {"error": "예측 데이터가 없습니다."}
        target_row = future_df.iloc[-1]

        return {
            "ticker": ticker,
            "target_date": target_date,
            "days_ahead": days_diff,
            "current_price": current_price,
            "predicted_price": round(float(target_row["yhat"]), 1),
            "lower": round(float(target_row["yhat_lower"]), 1),
            "upper": round(float(target_row["yhat_upper"]), 1),
            "change_pct": round((float(target_row["yhat"]) - current_price) / current_price * 100, 2),
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    test_ticker = "005930.KS"  # 삼성전자
    test_sentiment = Sentiment(positive=0.7, negative=0.3)

    print("=" * 60)
    print(f"🚀 Prophet 예측 및 거래량 통합 분석 테스트: {test_ticker}")
    print("=" * 60)

    # USE_MOCK = False 로 테스트
    os.environ["USE_MOCK_DATA"] = "false"
    USE_MOCK = False

    res = predict(test_ticker, price=75000.0, sentiment=test_sentiment)

    print(f"\n📊 거래량 리포트:\n {res.volume_analysis}")
    print(f"\n📈 최근 7일 거래량: {res.volume_history}")
    print(f"\n⚠️ 변동성 경고: {res.prediction_warning}\n")

    print("[7일 주가 예측 결과]")
    for p in res.prediction:
        print(f"  Day {p.day}: 예측가 {p.future_price:,.0f}원 (구간: {p.lower:,.0f} ~ {p.upper:,.0f}) | 신뢰도 {p.confidence_score}점")