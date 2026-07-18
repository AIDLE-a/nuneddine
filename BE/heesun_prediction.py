"""
[담당: 희선]
Prophet 기반 7일 주가 예측(1일 단위 세분화) + 감성 점수로 보정.
스스로 "예측 불확실성"을 판단해서 같이 반환.
★ [추가] 과거 거래량 데이터 추출(volume_history) 및 거래량 분석(volume_analysis) 포함.

환경변수:
  USE_MOCK_DATA=false  실제 Prophet 예측 사용
"""
import os
import time
import yfinance as yf  # ★ 거래량 수집을 위해 추가
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
        # Mock 데이터용 가상 거래량 생성 (최근 7일치)
        volume_history = [1200000, 1500000, 900000, 1100000, 1300000, 2100000, 1800000]
        volume_analysis = _analyze_volume(volume_history)
    else:
        base = _run_prophet(ticker, price)
        # ★ 실데이터 작동 시 yfinance를 통해 과거 7일간의 실제 거래량 가져오기
        volume_history = _get_actual_volume_history(ticker)
        volume_analysis = _analyze_volume(volume_history)

    adjusted = [_adjust_with_sentiment(day, sentiment) for day in base]
    prediction_warning = _check_prediction_uncertainty(adjusted)
    
    # ★ schemas.py의 PredictionResult 정의에 맞게 volume_history와 volume_analysis를 추가하여 반환
    return PredictionResult(
        prediction=adjusted, 
        prediction_warning=prediction_warning,
        volume_history=volume_history,        # ★ 추가
        volume_analysis=volume_analysis       # ★ 추가
    )


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


# ==========================================
# ★ [추가 개발] 거래량 수집 및 분석 헬퍼 함수들
# ==========================================

def _get_actual_volume_history(ticker: str) -> list[int]:
    """yfinance를 이용하여 영업일 기준 최근 7일 동안의 실제 거래량을 가져옵니다."""
    try:
        stock = yf.Ticker(ticker)
        # 과거 1개월 데이터를 넉넉히 가져온 뒤 최근 7영업일 추출
        hist = stock.history(period="1mo")
        if not hist.empty:
            volumes = hist['Volume'].tail(7).tolist()
            return [int(v) for v in volumes]
    except Exception as e:
        print(f"❌ 거래량 수집 실패 ({ticker}): {e}")
    
    # 실패 시 Fallback 기본 데이터
    return [0, 0, 0, 0, 0, 0, 0]


def _analyze_volume(volume_history: list[int]) -> str:
    """최근 거래량 흐름을 간단하게 분석하여 AI 리포트용 자연어 텍스트를 생성합니다."""
    if not volume_history or len(volume_history) < 2:
        return "최근 거래량 데이터가 충분하지 않아 흐름 분석이 제한적입니다."

    yesterday_vol = volume_history[-1]
    prev_avg_vol = sum(volume_history[:-1]) / len(volume_history[:-1]) if len(volume_history) > 1 else 1

    if prev_avg_vol == 0:
        return "거래량 데이터가 0으로 나타나 분석을 건너뜁니다."

    # 직전 평균 대비 최근(어제) 거래량 증가율 계산
    increase_rate = (yesterday_vol - prev_avg_vol) / prev_avg_vol * 100

    if increase_rate >= 50:
        return f"최근 거래량이 이전 평균 대비 {increase_rate:.1f}% 급증하며 시장의 강한 매수 세력 혹은 관심이 유입되고 있습니다. 가격 변동폭 확대를 유의하세요."
    elif increase_rate <= -30:
        return f"최근 거래량이 이전 평균 대비 {abs(increase_rate):.1f}% 급감하여 관망세가 짙어지고 있습니다. 단기 횡보 가능성이 높습니다."
    else:
        return "최근 거래량이 평소 수준을 유지하고 있어 급작스러운 수급 불균형 없이 안정적인 거래 흐름을 보이고 있습니다."