"""
[Critic 에이전트 — 희선]

3개 에이전트가 스스로 판단한 불확실성(info_warning, sentiment_warning,
prediction_warning)을 모으고, Critic 자체의 추가 검증(모순 체크)을 더해서
최종 경고 목록 + 종합 신뢰도 점수를 산출.

⚠️ 수정 노트 [100점 강제 제한 및 프론트 매핑 보완]:
   1. signal_score (감성/수급/재무/모멘텀)의 상한선을 강화하여 
      4개 알파가 완벽하게 일치하지 않으면 절대로 90점 이상이 나올 수 없도록 수정.
   2. breakdown 키값에 프론트엔드에서 참조하기 쉬운 키 이름들을 함께 포함하여 반환.
"""

from typing import List, Tuple
from schemas import StockDataResult, SentimentResult, PredictionResult, Prediction
from rag_store import search_similar_cases

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

        final_pred = prediction_result.prediction[-1] if prediction_result.prediction else None
        sentiment = sentiment_result.sentiment
        news_conf = getattr(getattr(data_result, "news_uncertainty", None), "confidence", None)

        foreign = getattr(data_result, "foreign_history", [])
        institution = getattr(data_result, "institution_history", [])
        foreign_trend = "순매수" if foreign and sum(foreign[:3]) > 0 else "순매도"
        institution_trend = "순매수" if institution and sum(institution[:3]) > 0 else "순매도"

        sentiment_alpha = getattr(getattr(sentiment_result, "alpha", None), "sentiment_alpha", 0)
        flow_alpha = getattr(data_result, "flow_alpha", 0)
        financial_alpha = getattr(data_result, "financial_alpha", 0)
        momentum_alpha = getattr(data_result, "momentum_alpha", 0)

        market_index = getattr(data_result, "market_index", {}) or {}
        kospi = market_index.get("kospi", {})
        kospi_alpha = round(kospi.get("change_5d", 0) * 2, 3)

        target_mean = getattr(getattr(data_result, "financial", None), "target_mean_price", None)
        current_price = getattr(data_result, "price", 0)
        analyst_alpha = 0
        if target_mean and current_price:
            upside = (target_mean - current_price) / current_price
            analyst_alpha = round(max(-1.0, min(1.0, upside * 0.5)), 3)

        # Bayesian 불확실성
        bayesian_unc = getattr(sentiment_result, "bayesian_uncertainty", 0.0) or 0.0

        composite_alpha = round(
            sentiment_alpha  * 0.25 +
            flow_alpha       * 0.25 +
            financial_alpha  * 0.15 +
            momentum_alpha   * 0.15 +
            kospi_alpha      * 0.10 +
            analyst_alpha    * 0.10,
            3
        )
        alpha_signal = "강한매수" if composite_alpha > 0.4 else "매수" if composite_alpha > 0.2 else "강한매도" if composite_alpha < -0.4 else "매도" if composite_alpha < -0.2 else "중립"

        top_news = [n.title for n in data_result.news[:5]]
        news_headlines = "\n".join([f"  • {t[:60]}" for t in top_news])

# RAG: 비슷한 과거 사례 검색
        situation_query = f"{data_result.ticker if hasattr(data_result, 'ticker') else ''} " + " ".join(top_news[:3])
        similar_cases = search_similar_cases(situation_query, top_k=2)

        print(f"🔍 RAG 검색 결과: {len(similar_cases)}건 — {[c['ticker'] for c in similar_cases]}")


        similar_cases_text = ""
        if similar_cases:
            case_lines = []
            for c in similar_cases:
                case_lines.append(f"- [{c['date']}] {c['reasoning_snippet']}" + (f" → 결과 진단: {c['critique']}" if c['critique'] else ""))
            similar_cases_text = "\n".join(case_lines)

        prompt = f"""당신은 전문 주식 리서치 AI Critic 에이전트입니다.
퀀트 펀드 방식으로 멀티 에이전트 분석 결과를 종합하여 전문적인 투자 참고 리포트를 작성하세요.

━━━━━━━━━━━ 에이전트 분석 데이터 ━━━━━━━━━━━

[뉴스 에이전트]
- 수집 뉴스: {len(data_result.news)}건 / 데이터 신뢰도: {f"{news_conf:.0%}" if news_conf else "알 수 없음"}
- 주요 헤드라인:
{news_headlines}

[감성 에이전트]
- 긍정: {sentiment.positive:.1%} / 부정: {sentiment.negative:.1%}
- 감성 알파: {sentiment_alpha:+.3f}
- 주요 키워드: {getattr(sentiment_result, "top_keywords", "없음") or "없음"}
- 경고: {sentiment_result.sentiment_warning or "없음"}

[수급 에이전트]
- 외국인: 최근 3일 {foreign_trend} / 수급 알파: {flow_alpha:+.3f}
- 기관: 최근 3일 {institution_trend}

[재무 에이전트]
- 재무 알파: {financial_alpha:+.3f}
- ROE: {getattr(getattr(data_result, "financial", None), "roe", None) and f"{getattr(data_result.financial, 'roe') * 100:.1f}%" or "알 수 없음"}
- 매출 성장률: {getattr(getattr(data_result, "financial", None), "revenue_growth", None) and f"{getattr(data_result.financial, 'revenue_growth') * 100:.1f}%" or "알 수 없음"}

[모멘텀 에이전트]
- 모멘텀 알파: {momentum_alpha:+.3f}

[시장 지수]
- 코스피: {kospi.get("current", "-")} ({kospi.get("trend", "-")}) / 5일 변화: {kospi_alpha:+.3f}
- 증권사 평균 목표주가: {f"{target_mean:,.0f}원" if target_mean else "없음"} (업사이드: {f"{analyst_alpha:+.3f}" if analyst_alpha else "-"})

[종합 알파 팩터]: {composite_alpha:+.3f} → {alpha_signal}

[예측 에이전트]
- 7일 후 예측가: {f"{final_pred.future_price:,.0f}원" if final_pred else "없음"}
- 신뢰구간: {f"{final_pred.lower:,.0f} ~ {final_pred.upper:,.0f}원" if final_pred else "없음"}
- 예측 경고: {prediction_result.prediction_warning or "없음"}

[참고 과거 사례] (※ 참고용일 뿐입니다. 현재 상황과 본질적으로 다르면 무시하세요)
{similar_cases_text if similar_cases_text else "관련 과거 사례 없음"}

[Critic 종합 신뢰도]: {confidence_score}/100
[Bayesian 감성 불확실성]: {bayesian_unc:.4f} ({"낮음 ✅" if bayesian_unc < 0.02 else "보통 ⚠️" if bayesian_unc < 0.05 else "높음 ❌"})
[경고 목록]: {", ".join(warnings) if warnings else "없음"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

작성 지침에 따라 투자 참고 리포트를 작성하세요."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "당신은 한국 증권사 수석 애널리스트입니다. 한국어로 전문 리포트를 작성하세요."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.2,
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f"⚠️ LLM Critic 실패: {e}")
        return None


def review(
    data_result: StockDataResult,
    sentiment_result: SentimentResult,
    prediction_result: PredictionResult,
) -> Tuple[List[str], int, str, dict]:
    """메인 오케스트레이터 호출 함수"""
    warnings = _collect_warnings(data_result, sentiment_result, prediction_result)
    confidence_score, confidence_breakdown = _calc_confidence(data_result, sentiment_result, prediction_result)

    llm_report = _llm_critique(data_result, sentiment_result, prediction_result, warnings, confidence_score)

    return warnings, confidence_score, llm_report, confidence_breakdown


def _get_final_day(prediction_result: PredictionResult) -> Prediction:
    if not prediction_result or not prediction_result.prediction:
        return Prediction(day=7, future_price=0.0, lower=0.0, upper=0.0, confidence_score=50)
    return prediction_result.prediction[-1]


def _get_worst_spread_ratio(prediction_result: PredictionResult) -> float:
    if not prediction_result or not prediction_result.prediction:
        return 0.1
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
    warnings = []
    if getattr(data_result, "info_warning", None):
        warnings.append(data_result.info_warning)
    if getattr(sentiment_result, "sentiment_warning", None):
        warnings.append(sentiment_result.sentiment_warning)
    if getattr(prediction_result, "prediction_warning", None):
        warnings.append(prediction_result.prediction_warning)

    final_day = _get_final_day(prediction_result)
    if sentiment_result and getattr(sentiment_result, "sentiment", None) and data_result:
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
) -> Tuple[int, dict]:
    """
    종합 신뢰도 재산출 (100점 과도 도출 완전 방지)
    """
    # ① 데이터 품질 점수
    news_count = len(data_result.news) if getattr(data_result, "news", None) else 0
    news_qty_score = min(news_count / 50.0, 1.0)
    news_conf = getattr(getattr(data_result, "news_uncertainty", None), "confidence", 0.75)
    data_quality = (news_qty_score * 0.4 + news_conf * 0.6) * 100

    # ② 신호 일치도 점수 (감성/수급/재무/모멘텀) - [강력한 상한선 반영]
    sentiment_alpha = getattr(getattr(sentiment_result, "alpha", None), "sentiment_alpha", 0)
    flow_alpha = getattr(data_result, "flow_alpha", 0)
    financial_alpha = getattr(data_result, "financial_alpha", 0)
    momentum_alpha = getattr(data_result, "momentum_alpha", 0)

    alphas = [sentiment_alpha, flow_alpha, financial_alpha, momentum_alpha]
    
    # 방향 판정 (+0.03 기준)
    pos_count = sum(1 for a in alphas if a > 0.03)
    neg_count = sum(1 for a in alphas if a < -0.03)
    max_align = max(pos_count, neg_count)

    # 4개 일치: 85~95점, 3개 일치: 70~80점, 2개 일치: 50~60점, 이하: 40점
    if max_align == 4:
        base_signal = 88.0
    elif max_align == 3:
        base_signal = 72.0
    elif max_align == 2:
        base_signal = 55.0
    else:
        base_signal = 40.0

    # 감성 명확도 보정 (+- 5점)
    if sentiment_result and getattr(sentiment_result, "sentiment", None):
        sentiment = sentiment_result.sentiment
        clarity = abs(sentiment.positive - sentiment.negative) # 0.0 ~ 1.0
        clarity_bonus = (clarity - 0.5) * 10  # -5 ~ +5점
    else:
        clarity_bonus = 0

    signal_score = min(98, max(30, base_signal + clarity_bonus))

    # ③ 예측 안정성 점수
    spread_ratio = _get_worst_spread_ratio(prediction_result)
    spread_score = max(0.0, 1.0 - (spread_ratio / 0.15)) * 100
    spread_score = max(30, min(95, spread_score))

    pred_conf = 60
    if prediction_result and prediction_result.prediction:
        confs = [p.confidence_score for p in prediction_result.prediction]
        pred_conf = max(50, sum(confs) / len(confs))

    prediction_stability = spread_score * 0.5 + pred_conf * 0.5

    # ④ 시장 뒷받침 점수
    market_index = getattr(data_result, "market_index", {}) or {}
    kospi = market_index.get("kospi", {})
    kospi_5d = kospi.get("change_5d", 0)
    kospi_score = max(0, min(100, 50 + (kospi_5d * 500)))

    foreign = getattr(data_result, "foreign_history", []) or []
    foreign_3d = sum(foreign[:3]) if len(foreign) >= 3 else 0
    foreign_score = 70 if foreign_3d > 0 else 30

    market_support = kospi_score * 0.5 + foreign_score * 0.5

    # 최종 종합 점수
    final = (
        data_quality        * 0.25 +
        signal_score        * 0.35 +
        prediction_stability * 0.25 +
        market_support      * 0.15
    )
    final_score = max(10, min(99, int(round(final))))

    # 프론트엔드가 어떤 변수명으로 받아도 인식할 수 있도록 호환 키 제공
    breakdown = {
        # 백엔드 표준 키
        "data_quality": round(data_quality),
        "signal_score": round(signal_score),
        "prediction_stability": round(prediction_stability),
        "market_support": round(market_support),
        
        # 프론트엔드 UI 호환용 키
        "info": round(data_quality),
        "multi_factor": round(signal_score),
        "sentiment_flow": round(signal_score),
        "prediction": round(prediction_stability),
        "report": final_score
    }

    return final_score, breakdown

# ↓↓↓ critic.py 파일 맨 끝에 이 함수만 추가하세요 (기존 코드는 그대로 둠) ↓↓↓

def diagnose_outcome(
    ticker_name: str,
    predicted_price: float,
    actual_price: float,
    llm_report: str | None = None,
) -> dict:
    """
    사후 진단 — target_date 도달 후 예측 vs 실제 비교해서 실패 유형 텍스트화
    (review()는 예측 '전' 신뢰도 산출용, 이건 예측 '후' critique용 — 역할 분리)
    batch_collect.py가 target_date 도달 시 호출.
    """
    try:
        import os
        from groq import Groq
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env")

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            return {"critique": None, "failure_type": None}

        client = Groq(api_key=api_key)
        error = actual_price - predicted_price
        error_pct = round(error / predicted_price * 100, 2) if predicted_price else 0

        prompt = f"""당신은 주식 예측 결과를 사후 검증하는 Critic입니다.

종목: {ticker_name}
예측가: {predicted_price:,.0f}원
실제가: {actual_price:,.0f}원
오차: {error:+,.0f}원 ({error_pct:+.2f}%)

예측 당시 근거 리포트:
{llm_report or "없음"}

위 정보를 바탕으로:
1. 왜 예측이 실제와 이만큼 벗어났는지(또는 잘 맞았는지) 2~3문장으로 진단
2. 실패 유형을 한 단어 카테고리로 태깅 (예: 감성과신, 이벤트미반영, 수급오판, 적중)

형식:
진단: <2~3문장>
유형: <카테고리 한 단어>"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 한국 증권사 애널리스트입니다. 반드시 한국어로만, 간결하게 작성하세요. 추측성 표현 대신 단정적으로 서술하세요.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        text = response.choices[0].message.content

        if "유형:" in text:
            critique = text.split("유형:")[0].replace("진단:", "").strip()
            failure_type = text.split("유형:")[-1].strip()
        else:
            critique = text.strip()
            failure_type = None

        return {"critique": critique, "failure_type": failure_type}

    except Exception as e:
        print(f"⚠️ 사후 진단 실패: {e}")
        return {"critique": None, "failure_type": None}