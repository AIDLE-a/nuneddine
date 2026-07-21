"""
[Critic 에이전트 — 희선]

3개 에이전트가 스스로 판단한 불확실성(info_warning, sentiment_warning,
prediction_warning)을 모으고, Critic 자체의 추가 검증(모순 체크)을 더해서
최종 경고 목록 + 종합 신뢰도 점수를 산출.

이게 "AI가 자기 한계를 아는 시스템"의 핵심 — 각 에이전트가 스스로 불확실성을
보고하고, Critic이 그걸 모아 판단하는 구조.
"""

from typing import List, Tuple
from schemas import StockDataResult, SentimentResult, PredictionResult, Prediction


def review(
    data_result: StockDataResult,
    sentiment_result: SentimentResult,
    prediction_result: PredictionResult,
) -> Tuple[List[str], int]:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함. (경고 목록, 신뢰도 점수) 반환"""
    warnings = _collect_warnings(data_result, sentiment_result, prediction_result)
    confidence_score = _calc_confidence(data_result, sentiment_result, prediction_result)
    return warnings, confidence_score


def _get_final_day(prediction_result: PredictionResult) -> Prediction:
    """7일 중 가장 먼 미래(마지막 날) 예측을 대표값으로 사용"""
    if not prediction_result or not prediction_result.prediction:
        # 리스트가 비어있는 경우 Fallback
        return Prediction(day=7, future_price=0.0, lower=0.0, upper=0.0, confidence_score=50)
    return prediction_result.prediction[-1]


def _get_worst_spread_ratio(prediction_result: PredictionResult) -> float:
    """7일 중 가장 불확실한(구간이 넓은) 날 기준 비율 — 보수적으로 신뢰도에 반영"""
    if not prediction_result or not prediction_result.prediction:
        return 0.1  # 기본 10% 변동성 가정

    ratios = []
    for p in prediction_result.prediction:
        if p.future_price > 0:
            ratios.append((p.upper - p.lower) / p.future_price)
        else:
            ratios.append(0.0)

    return max(ratios) if ratios else 0.1


def _collect_warnings(
    data_result: StockDataResult,
    sentiment_result: SentimentResult,
    prediction_result: PredictionResult
) -> List[str]:
    """① 각 에이전트가 스스로 보낸 경고 수집 + ② Critic 자체 모순 검증"""
    warnings = []

    # ① 에이전트들이 스스로 보낸 불확실성 신호
    if getattr(data_result, "info_warning", None):
        warnings.append(data_result.info_warning)
    if getattr(sentiment_result, "sentiment_warning", None):
        warnings.append(sentiment_result.sentiment_warning)
    if getattr(prediction_result, "prediction_warning", None):
        warnings.append(prediction_result.prediction_warning)

    # ② Critic 자체 검증 — 감성 방향과 예측 방향(7일 후 기준)이 모순되는지 확인
    final_day = _get_final_day(prediction_result)
    
    if sentiment_result and sentiment_result.sentiment and data_result:
        sentiment_direction = sentiment_result.sentiment.positive - sentiment_result.sentiment.negative
        current_price = getattr(data_result, "price", 0.0) or 0.0
        
        if current_price > 0 and final_day.future_price > 0:
            price_direction = final_day.future_price - current_price

            if sentiment_direction > 0.15 and price_direction < 0:
                warnings.append("감성은 긍정적인데 예측은 하락 — 모순 가능성")
            elif sentiment_direction < -0.15 and price_direction > 0:
                warnings.append("감성은 부정적인데 예측은 상승 — 모순 가능성")

    return warnings


def _calc_confidence(
    data_result: StockDataResult,
    sentiment_result: SentimentResult,
    prediction_result: PredictionResult
) -> int:
    """0~100 종합 신뢰도 점수 — 뉴스량 / 감성 명확성 / 예측 변동성 가중 평균"""
    # 1. 뉴스 데이터량 점수 (최대 10개 기준)
    news_count = len(data_result.news) if data_result and data_result.news else 0
    news_score = min(news_count / 10.0, 1.0) * 100

    # 2. 감성 명확성 점수 (|긍정 - 부정|)
    if sentiment_result and sentiment_result.sentiment:
        sentiment = sentiment_result.sentiment
        sentiment_score = abs(sentiment.positive - sentiment.negative) * 100
    else:
        sentiment_score = 50.0

    # 3. 예측 변동성 점수 (보수적 반영)
    spread_ratio = _get_worst_spread_ratio(prediction_result)
    volatility_score = max(0.0, 100.0 - (spread_ratio * 500.0))

    # 가중 평균 (뉴스 30% / 감성 30% / 시계열 변동성 40%)
    score = (news_score * 0.3) + (sentiment_score * 0.3) + (volatility_score * 0.4)
    
    # 최소 10점 ~ 최대 99점 범위로 클리핑
    final_score = int(round(score))
    return max(10, min(99, final_score))