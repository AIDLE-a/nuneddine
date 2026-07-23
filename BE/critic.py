
def _llm_critique(
    data_result,
    sentiment_result,
    prediction_result,
    warnings: list,
    confidence_score: int,
) -> str:
    """
    Groq LLM 기반 Critic 에이전트
    3개 에이전트 결과를 종합해서 자연어 리포트 생성
    Self-Consistency + MoE 원리 적용
    """
    try:
        import os
        from groq import Groq
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env")

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            return None

        client = Groq(api_key=api_key)

        # 각 에이전트 결과 요약
        final_pred = prediction_result.prediction[-1] if prediction_result.prediction else None
        sentiment = sentiment_result.sentiment
        news_conf = getattr(getattr(data_result, "news_uncertainty", None), "confidence", None)

        # 수급 트렌드
        foreign = getattr(data_result, "foreign_history", [])
        institution = getattr(data_result, "institution_history", [])
        foreign_trend = "순매수" if foreign and sum(foreign[:3]) > 0 else "순매도"
        institution_trend = "순매수" if institution and sum(institution[:3]) > 0 else "순매도"

        prompt = f"""당신은 주식 리서치 AI Critic 에이전트입니다.
아래 3개 에이전트의 분석 결과를 교차 검증하고 최종 판단을 내려주세요.

[뉴스 에이전트]
- 수집 뉴스: {len(data_result.news)}건
- 데이터 신뢰도: {f"{news_conf:.0%}" if news_conf else "알 수 없음"}

[감성 에이전트]
- 긍정: {sentiment.positive:.1%}, 부정: {sentiment.negative:.1%}
- 감성 경고: {sentiment_result.sentiment_warning or "없음"}
- 주요 키워드: {getattr(sentiment_result, "top_keywords", "없음") or "없음"}

[예측 에이전트]
- 7일 후 예측가: {f"{final_pred.future_price:,.0f}원" if final_pred else "없음"}
- 신뢰구간: {f"{final_pred.lower:,.0f} ~ {final_pred.upper:,.0f}원" if final_pred else "없음"}
- 예측 경고: {prediction_result.prediction_warning or "없음"}

[수급 데이터]
- 외국인: 최근 3일 {foreign_trend}
- 기관: 최근 3일 {institution_trend}

[Critic 종합 신뢰도]: {confidence_score}/100
[현재 경고]: {", ".join(warnings) if warnings else "없음"}

다음 형식으로 2~3문장의 간결한 한국어 분석을 작성하세요.
- 에이전트 간 모순이 있으면 지적하세요
- 투자자에게 핵심 정보를 전달하세요
- AI의 한계를 명시하세요
- 투자 권유는 하지 마세요"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f"⚠️ LLM Critic 실패: {e}")
        return None

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

    # ── LLM Critic 에이전트 (Groq) ──
    llm_report = _llm_critique(data_result, sentiment_result, prediction_result, warnings, confidence_score)
    if llm_report:
        print(f"🤖 LLM Critic 리포트:\n{llm_report}")

    return warnings, confidence_score, llm_report


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