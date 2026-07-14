"""
[담당: 희선]
Prophet 기반 7일 주가 예측(1일 단위 세분화) + 감성 점수로 보정.
스스로 "예측 불확실성"을 판단해서 같이 반환.

환경변수:
  USE_MOCK_DATA=false  실제 Prophet 예측 사용
"""
import os
import time
from schemas import Prediction, PredictionResult, Sentiment

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
SENTIMENT_ADJUSTMENT_WEIGHT = 0.02
FORECAST_DAYS = 7

# 종목별 Prophet 결과 캐시 (1시간 유효)
_cache: dict = {}
_CACHE_TTL = 3600


def predict(ticker: str, price: float, sentiment: Sentiment) -> PredictionResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK:
        base = _get_mock_prediction(price)
    else:
        base = _run_prophet(ticker, price)

    adjusted = [_adjust_with_sentiment(day, sentiment) for day in base]
    prediction_warning = _check_prediction_uncertainty(adjusted)
    return PredictionResult(prediction=adjusted, prediction_warning=prediction_warning)


def _run_prophet(ticker: str, price: float) -> list[Prediction]:
    # 캐시 확인 (1시간 이내면 재사용)
    cached = _cache.get(ticker)
    if cached and time.time() - cached["ts"] < _CACHE_TTL:
        print(f"⚡ {ticker} Prophet 캐시 사용")
        return cached["predictions"]

    from heesun_forecast import run_forecast_uncertainty

    result = run_forecast_uncertainty(ticker, forecast_days=FORECAST_DAYS)

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

    _cache[ticker] = {"predictions": predictions, "ts": time.time()}
    return predictions


def _adjust_with_sentiment(prediction: Prediction, sentiment: Sentiment) -> Prediction:
    """감성 점수로 예측을 보정 (휴리스틱 보정). confidence_score는 그대로 유지."""
    sentiment_score = sentiment.positive - sentiment.negative
    adjustment = 1 + sentiment_score * SENTIMENT_ADJUSTMENT_WEIGHT
    return Prediction(
        day=prediction.day,
        future_price=round(prediction.future_price * adjustment, 1),
        lower=round(prediction.lower * adjustment, 1),
        upper=round(prediction.upper * adjustment, 1),
        confidence_score=prediction.confidence_score,
    )


def _check_prediction_uncertainty(predictions: list[Prediction]) -> str | None:
    """7일 중 하나라도 구간이 현재가 대비 10% 넘게 벌어지면 경고."""
    for p in predictions:
        spread = p.upper - p.lower
        if spread / p.future_price > 0.1:
            return "변동성 높음"
    return None


def _get_mock_prediction(price: float) -> list[Prediction]:
    """일 단위로 완만하게 상승 + 날이 갈수록 구간(spread) 넓어지는 mock 데이터"""
    predictions = []
    for day in range(1, FORECAST_DAYS + 1):
        future_price = price * (1 + 0.015 * day / FORECAST_DAYS)
        spread_ratio = 0.01 + 0.005 * day  # 하루씩 지날수록 구간 넓어짐
        predictions.append(
            Prediction(
                day=day,
                future_price=round(future_price, 1),
                lower=round(future_price * (1 - spread_ratio), 1),
                upper=round(future_price * (1 + spread_ratio), 1),
                confidence_score=max(0, 100 - day * 8),  # mock용 임의 감소 점수
            )
        )
    return predictions