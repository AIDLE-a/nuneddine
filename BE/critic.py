"""
[Critic 에이전트 — 희선]

3개 에이전트가 스스로 판단한 불확실성(info_warning, sentiment_warning,
prediction_warning)을 모으고, Critic 자체의 추가 검증(모순 체크)을 더해서
최종 경고 목록 + 종합 신뢰도 점수를 산출.

이게 "AI가 자기 한계를 아는 시스템"의 핵심 — 각 에이전트가 스스로 불확실성을
보고하고, Critic이 그걸 모아 판단하는 구조.
"""
from schemas import StockDataResult, SentimentResult, PredictionResult


def review(
    data_result: StockDataResult,
    sentiment_result: SentimentResult,
    prediction_result: PredictionResult,
) -> tuple[list[str], int]:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함. (경고 목록, 신뢰도 점수) 반환"""
    warnings = _collect_warnings(data_result, sentiment_result, prediction_result)
    confidence_score = _calc_confidence(data_result, sentiment_result, prediction_result)
    return warnings, confidence_score


def _collect_warnings(data_result, sentiment_result, prediction_result) -> list[str]:
    """① 각 에이전트가 스스로 보낸 경고 수집 + ② Critic 자체 모순 검증"""
    warnings = []

    # ① 에이전트들이 스스로 보낸 불확실성 신호
    if data_result.info_warning:
        warnings.append(data_result.info_warning)
    if sentiment_result.sentiment_warning:
        warnings.append(sentiment_result.sentiment_warning)
    if prediction_result.prediction_warning:
        warnings.append(prediction_result.prediction_warning)

    # ② Critic 자체 검증 — 감성 방향과 예측 방향이 모순되는지 확인
    sentiment_direction = sentiment_result.sentiment.positive - sentiment_result.sentiment.negative
    price_direction = prediction_result.prediction.future_price - data_result.price

    if sentiment_direction > 0.15 and price_direction < 0:
        warnings.append("감성은 긍정적인데 예측은 하락 — 모순 가능성")
    elif sentiment_direction < -0.15 and price_direction > 0:
        warnings.append("감성은 부정적인데 예측은 상승 — 모순 가능성")

    return warnings


def _calc_confidence(data_result, sentiment_result, prediction_result) -> int:
    """0~100 종합 신뢰도 점수 — 뉴스량/감성 명확성/예측 변동성 가중 평균"""
    news_score = min(len(data_result.news) / 10, 1.0) * 100

    sentiment = sentiment_result.sentiment
    sentiment_score = abs(sentiment.positive - sentiment.negative) * 100

    prediction = prediction_result.prediction
    spread_ratio = (prediction.upper - prediction.lower) / prediction.future_price
    volatility_score = max(0, 100 - spread_ratio * 500)

    score = news_score * 0.3 + sentiment_score * 0.3 + volatility_score * 0.4
    return int(round(score))
