"""
[담당: 희선]
Prophet 기반 7일 주가 예측 + 감성 점수로 보정.
스스로 "예측 불확실성"을 판단해서 같이 반환.

환경변수:
  USE_MOCK_DATA=false  실제 Prophet 예측 사용
"""
import os
from schemas import Prediction, PredictionResult, Sentiment

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
SENTIMENT_ADJUSTMENT_WEIGHT = 0.02  # 감성이 예측에 영향을 줄 수 있는 최대 비율 (±2%)


def predict(ticker: str, price: float, sentiment: Sentiment) -> PredictionResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK:
        base = _get_mock_prediction(price)
    else:
        base = _run_prophet(ticker, price)

    adjusted = _adjust_with_sentiment(base, sentiment)
    prediction_warning = _check_prediction_uncertainty(adjusted)
    return PredictionResult(prediction=adjusted, prediction_warning=prediction_warning)


def _run_prophet(ticker: str, price: float) -> Prediction:
    """
    희선의 forecast_uncertainty.py를 활용한 실제 Prophet 예측.
    tools/forecast_uncertainty.py의 run_forecast_uncertainty()를 호출.
    """
    from heesun_forecast import run_forecast_uncertainty
    result = run_forecast_uncertainty(ticker, forecast_days=7)
    return Prediction(
        future_price=result["predicted_price"],
        lower=result["lower_bound"],
        upper=result["upper_bound"],
    )


def _adjust_with_sentiment(prediction: Prediction, sentiment: Sentiment) -> Prediction:
    """감성 점수로 예측을 보정 (휴리스틱 보정)"""
    sentiment_score = sentiment.positive - sentiment.negative
    adjustment = 1 + sentiment_score * SENTIMENT_ADJUSTMENT_WEIGHT
    return Prediction(
        future_price=round(prediction.future_price * adjustment, 1),
        lower=round(prediction.lower * adjustment, 1),
        upper=round(prediction.upper * adjustment, 1),
    )


def _check_prediction_uncertainty(prediction: Prediction) -> str | None:
    spread = prediction.upper - prediction.lower
    if spread / prediction.future_price > 0.1:
        return "변동성 높음"
    return None


def _get_mock_prediction(price: float) -> Prediction:
    return Prediction(
        future_price=round(price * 1.015, 1),
        lower=round(price * 0.97, 1),
        upper=round(price * 1.06, 1),
    )
