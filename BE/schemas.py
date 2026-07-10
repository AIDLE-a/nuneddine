"""
팀 전체가 합의한 JSON 계약
이 파일은 희선이 관리하고, 다른 팀원은 이 형식에 맞춰 데이터를 반환해야 함.
형식이 바뀌면 반드시 팀 전체에 공유 후 수정.
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
    future_price: float
    lower: float
    upper: float


class PredictionResult(BaseModel):
    """희선이 만드는 결과물 — 예측 불확실성을 스스로 판단해서 같이 반환"""
    prediction: Prediction
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
    prediction: Prediction
    sentiment: Sentiment
    warnings: List[str]
    confidence_score: int
    explanation: List[WordContribution] = []