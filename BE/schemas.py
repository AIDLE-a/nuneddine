"""
팀 전체가 합의한 JSON 계약
이 파일은 희선이 관리하고, 다른 팀원은 이 형식에 맞춰 데이터를 반환해야 함.
형식이 바뀌면 반드시 팀 전체에 공유 후 수정.

✅ 핵심 변경: 각 에이전트가 "자기 불확실성"을 스스로 계산해서 같이 반환함.
   Critic 에이전트가 이걸 모아서 최종 경고 + 신뢰도 점수를 산출함.
"""
from pydantic import BaseModel
from typing import List, Optional


# ── 유빈 담당: 뉴스 에이전트 결과 형식 ──
class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: str


class StockDataResult(BaseModel):
    """유빈이 만드는 결과물 — 정보 불확실성을 스스로 판단해서 같이 반환"""
    ticker: str
    price: float
    price_history: List[float] = []  # 최근 7거래일 종가 (차트용)
    news: List[NewsItem]
    info_warning: Optional[str] = None  # 예: "뉴스 부족"


# ── 연우 담당: 감성 에이전트 결과 형식 ──
class Sentiment(BaseModel):
    positive: float
    negative: float


class WordContribution(BaseModel):
    """XAI 설명 — 단어별 감성 기여도"""
    word: str
    contribution: float  # 양수=긍정 기여, 음수=부정 기여


class SentimentTrend(BaseModel):
    """감성 트렌드 — 최근 vs 과거 기사 비교"""
    direction: str
    recent_score: float
    old_score: float
    change: float


class SentimentResult(BaseModel):
    """연우가 만드는 결과물 — 감성 불확실성을 스스로 판단해서 같이 반환"""
    sentiment: Sentiment
    explanation: List[WordContribution] = []
    sentiment_warning: Optional[str] = None  # 예: "감성 신호 불명확"
    trend: Optional[SentimentTrend] = None
    top_keywords: Optional[str] = None
    volatility: Optional[float] = None


# ── 희선 담당: 예측 에이전트 결과 형식 ──
class Prediction(BaseModel):
    future_price: float
    lower: float
    upper: float


class PredictionResult(BaseModel):
    """희선이 만드는 결과물 — 예측 불확실성을 스스로 판단해서 같이 반환"""
    prediction: Prediction
    prediction_warning: Optional[str] = None  # 예: "변동성 높음"


# ── 희선 담당: 최종 통합 응답 (채민이 받는 최종 형식, 변경 없음) ──
class StockAnalysisResponse(BaseModel):
    """
    Critic 에이전트가 3개 에이전트 결과 + 자체 모순 검증을 합쳐서 만드는 최종 응답.
    채민은 이 형식만 보고 프론트엔드를 만들면 됨. (이 부분은 안 바뀜)
    """
    ticker: str
    price: float
    price_history: List[float] = []  # 최근 7일 실제 종가 (차트용, 유빈 추가)
    news: List[NewsItem]
    prediction: Prediction
    sentiment: Sentiment
    warnings: List[str]
    confidence_score: int
    explanation: List[WordContribution] = []
