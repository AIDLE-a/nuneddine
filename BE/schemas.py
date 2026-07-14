"""
팀 전체가 합의한 JSON 계약
이 파일은 희선이 관리하고, 다른 팀원은 이 형식에 맞춰 데이터를 반환해야 함.
형식이 바뀌면 반드시 팀 전체에 공유 후 수정.

[변경 이력]
- Prediction: 7일 단일 예측 → 1일 단위(day 1~7) 세분화로 변경
  - day: int, confidence_score: int 필드 추가
- PredictionResult.prediction: Prediction → List[Prediction]
- StockAnalysisResponse.prediction: Prediction → List[Prediction]
  (채민 프론트엔드 영향 있음 — 공유 필요)
"""
from pydantic import BaseModel
from typing import List, Optional


# ── 유빈 담당: 뉴스 에이전트 결과 형식 ──
class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: str
    description: Optional[str] = None  # 뉴스 요약 (감성 분석 정확도 향상용)


class StockDataResult(BaseModel):
    """유빈이 만드는 결과물 — 정보 불확실성을 스스로 판단해서 같이 반환"""
    ticker: str
    price: float
    price_history: List[float] = []
    news: List[NewsItem]
    info_warning: Optional[str] = None


# ── 연우 담당: 감성 에이전트 결과 형식 ──
class Sentiment(BaseModel):
    positive: float
    negative: float


class WordContribution(BaseModel):
    """XAI 설명 — 단어별 감성 기여도"""
    word: str
    contribution: float


class SentimentResult(BaseModel):
    """연우가 만드는 결과물 — 감성 불확실성을 스스로 판단해서 같이 반환"""
    sentiment: Sentiment
    explanation: List[WordContribution] = []
    sentiment_warning: Optional[str] = None


# ── 희선 담당: 예측 에이전트 결과 형식 ──
class Prediction(BaseModel):
    """1일 단위 예측 (day=1 ~ day=forecast_days)"""
    day: int
    future_price: float
    lower: float
    upper: float
    confidence_score: Optional[int] = None  # 0~100, 일자별 예측 신뢰도


class PredictionResult(BaseModel):
    """희선이 만드는 결과물 — 예측 불확실성을 스스로 판단해서 같이 반환"""
    prediction: List[Prediction]  # day 1~7 리스트
    prediction_warning: Optional[str] = None


# ── 최종 통합 응답 (채민이 받는 형식) ──
class StockAnalysisResponse(BaseModel):
    """
    Critic 에이전트가 3개 에이전트 결과 + 자체 모순 검증을 합쳐서 만드는 최종 응답.
    채민은 이 형식만 보고 프론트엔드를 만들면 됨.
    """
    ticker: str
    price: float
    price_history: List[float] = []
    news: List[NewsItem]
    prediction: List[Prediction]  # 변경: 단건 -> 1일 단위 리스트
    sentiment: Sentiment
    warnings: List[str]
    confidence_score: int
    explanation: List[WordContribution] = []