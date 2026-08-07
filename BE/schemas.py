"""
팀 전체가 합의한 JSON 계약 (거래량 반영 버전)
이 파일은 희선이 관리하고, 다른 팀원은 이 형식에 맞춰 데이터를 반환해야 함.
형식이 바뀌면 반드시 팀 전체에 공유 후 수정.

[변경 이력]
- Prediction: 7일 단일 예측 → 1일 단위(day 1~7) 세분화로 변경
  - day: int, confidence_score: int 필드 추가
- PredictionResult.prediction: Prediction → List[Prediction]
- StockAnalysisResponse.prediction: Prediction → List[Prediction]
  (채민 프론트엔드 영향 있음 — 공유 필요)
- SentimentResult: FE_CHAEMIN 병합 — trend/top_keywords/volatility 필드 추가
  - SentimentTrend 클래스 신설 (최근 vs 이전 기간 감성 추세 비교)
- [★추가] 거래량 시각화 및 리포트를 위한 Volume 필드 추가 (유빈/희선/채민 영향)
  - StockDataResult & StockAnalysisResponse: volume_history 추가
  - PredictionResult & StockAnalysisResponse: volume_analysis 추가
- [★추가 2] NewsInsight에 source_title 추가 (원본 뉴스 제목 — 출처 캡션/링크용)
- [★추가 3] SentimentResult/StockAnalysisResponse에 calculation_note 추가
  (긍정/부정 비율 계산 방식 설명 — 상세보기용)
- ⚠️ 정리: NewsInsight/SentimentResult가 파일 내에 실수로 두 번씩 정의되어 있던 것을
  하나로 통합함 (동작엔 영향 없었지만 혼동 방지)
- [★버그 수정 2026-08-02] StockAnalysisResponse에 sentiment_alpha 필드가 빠져 있어서
  발생한 데이터 정합성 버그 수정:
    1) 프론트(DetailReportModal.jsx)가 이 필드를 못 받아서
       sentiment.positive - sentiment.negative로 직접 재계산 → 변동성 보정 전
       원본값(예: +0.326)을 표시하게 됨
    2) main.py의 composite_alpha 계산식도 이 필드가 없어서 감성 알파(30%)를
       아예 빼먹고 수급+재무+모멘텀만으로 계산 → "종합 알파" 값이 실제보다
       낮게(또는 왜곡되게) 나옴
  → StockAnalysisResponse에 sentiment_alpha: float = 0.0 필드를 추가하고,
    main.py에서 sentiment_result.alpha.sentiment_alpha(변동성 보정된 최종값)를
    그대로 채워 넣도록 수정함. 프론트는 이제 재계산하지 말고 이 필드를
    그대로 표시해야 함.
"""
from pydantic import BaseModel
from typing import List, Optional


class RealtimePrice(BaseModel):
    """1분 단위 실시간 주가"""
    time: str      # "14:55" 형태
    price: float
    volume: int


class FinancialData(BaseModel):
    """재무제표 핵심 지표"""
    per: Optional[float] = None           # 주가수익비율 (낮을수록 저평가)
    forward_per: Optional[float] = None   # 예상 PER
    pbr: Optional[float] = None           # 주가순자산비율
    roe: Optional[float] = None           # 자기자본이익률 (높을수록 수익성 좋음)
    debt_to_equity: Optional[float] = None  # 부채비율 (낮을수록 안정적)
    revenue_growth: Optional[float] = None  # 매출 성장률
    earnings_growth: Optional[float] = None # 영업이익 성장률
    operating_margin: Optional[float] = None # 영업이익률
    current_ratio: Optional[float] = None   # 유동비율 (높을수록 안정적)
    target_mean_price: Optional[float] = None  # 증권사 평균 목표주가
    target_high_price: Optional[float] = None  # 증권사 최고 목표주가
    target_low_price: Optional[float] = None   # 증권사 최저 목표주가
    analyst_count: Optional[int] = None        # 분석 애널리스트 수
    recommendation: Optional[str] = None       # 투자의견 (strong_buy/buy/hold/sell)
    recommendation_trend: Optional[list] = None  # 월별 투자의견 트렌드
    target_median_price: Optional[float] = None  # 목표주가 중앙값


class InvestorData(BaseModel):
    """날짜별 기관/외국인/개인 순매매 데이터"""
    date: str
    institution: float = 0.0   # 기관 순매매 (양수=순매수, 음수=순매도)
    foreign: float = 0.0       # 외국인 순매매
    individual: float = 0.0    # 개인 순매매


# ── 유빈 담당: 뉴스 및 기초 데이터 에이전트 결과 형식 ──
class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: str
    description: Optional[str] = None  # 뉴스 요약 (감성 분석 정확도 향상용)


# ── 베이지안 불확실성 구조 (Uncertainty-aware Agent) ──
class UncertaintyResult(BaseModel):
    """
    각 에이전트의 불확실성 정량화
    논문: Uncertainty-aware soft sensor using Bayesian recurrent neural networks
    """
    epistemic: float    # 인식론적 불확실성 (데이터 부족, 0~1)
    aleatoric: float    # 우발적 불확실성 (노이즈/혼재, 0~1)
    confidence: float   # 최종 신뢰도 (0~1)
    reasoning: str      # 판단 이유


class NewsAgentResult(BaseModel):
    """뉴스 에이전트 결과 — 불확실성 포함"""
    news: List[NewsItem]
    uncertainty: UncertaintyResult
    retry_count: int = 0
    info_warning: Optional[str] = None


class StockDataResult(BaseModel):
    """유빈이 만드는 결과물 — 정보 불확실성을 스스로 판단해서 같이 반환"""
    ticker: str
    price: float
    price_history: List[float] = []
    volume_history: List[float] = []  # 과거 거래량 내역
    institution_history: List[float] = []
    foreign_history: List[float] = []
    individual_history: List[float] = []
    investor_data: List[InvestorData] = []
    financial: Optional[FinancialData] = None
    realtime: List[RealtimePrice] = []
    news_uncertainty: Optional[UncertaintyResult] = None  # 뉴스 에이전트 불확실성
    flow_alpha: float = 0.0       # 수급 알파 팩터
    financial_alpha: float = 0.0  # 재무 알파 팩터
    momentum_alpha: float = 0.0   # 모멘텀 알파 팩터
    market_index: Optional[dict] = None  # 코스피/코스닥 지수
    news: List[NewsItem]
    info_warning: Optional[str] = None


# ── 연우 담당: 감성 에이전트 결과 형식 ──
class Sentiment(BaseModel):
    positive: float
    negative: float


class WordContribution(BaseModel):
    """XAI 설명 — 단어별 감성 기여도 (레거시, FinBERT 폴백에서 일부 참고용으로 유지)"""
    word: str
    contribution: float


class NewsInsight(BaseModel):
    """
    호재/악재 뉴스 인사이트 항목.
    - title: 화면 메인에 노출되는 '이유' 문장
        · LLM 브리핑 성공 시: LLM이 생성한 요약 문장
        · LLM 실패 시(FinBERT XAI 폴백): chips 키워드를 조합해 만든 합성 문장
          (예: "HBM 공급·AI 투자 관련 이슈로 긍정적 신호")
    - source_title: 근거가 된 원본 뉴스 제목. 화면에는 작은 출처 캡션 + url 링크로 노출.
    - 뉴스 근거 자체가 없을 때: type="neutral"로 표시
    """
    type: str  # "positive" | "negative" | "neutral"
    title: str
    source_title: Optional[str] = None
    chips: List[str] = []
    url: str = "#"


class SentimentTrend(BaseModel):
    """최근 vs 이전 기간 감성 추세 비교 (yeonwoo_sentiment.py의 _calc_trend 참고)"""
    direction: str        # "긍정 방향으로 개선 중" | "부정 방향으로 악화 중" | "보합"
    recent_score: float   # 최근 기간(time_weight >= 0.7) 평균 감성 점수
    old_score: float       # 이전 기간(0.2 <= time_weight < 0.7) 평균 감성 점수
    change: float          # recent_score - old_score


class AlphaFactor(BaseModel):
    """퀀트 펀드 방식 알파 팩터 — 각 에이전트가 생성"""
    sentiment_alpha: float = 0.0    # 감성 알파 (-1 ~ +1) — 변동성 보정 완료된 최종값
    flow_alpha: float = 0.0         # 수급 알파 (-1 ~ +1)
    financial_alpha: float = 0.0    # 재무 알파 (-1 ~ +1)
    momentum_alpha: float = 0.0     # 모멘텀 알파 (-1 ~ +1)
    composite_alpha: float = 0.0    # 종합 알파 (-1 ~ +1)
    signal: str = "중립"           # 강한매수/매수/중립/매도/강한매도


class SentimentResult(BaseModel):
    """연우가 만드는 결과물 — 감성 불확실성을 스스로 판단해서 같이 반환"""
    sentiment: Sentiment
    explanation: List[NewsInsight] = []   # ← WordContribution에서 변경
    sentiment_warning: Optional[str] = None
    trend: Optional[SentimentTrend] = None
    top_keywords: Optional[str] = None
    volatility: Optional[float] = None
    alpha: Optional[AlphaFactor] = None  # 퀀트 알파 팩터 (sentiment_alpha 포함)
    bayesian_uncertainty: Optional[float] = None  # MC Dropout Bayesian 불확실성
    calculation_note: Optional[str] = None  # 긍정/부정 비율 계산 방식 설명 (상세보기용)


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
    volume_history: List[int] = []          # 최근 7영업일 거래량
    volume_analysis: Optional[str] = None   # "최근 거래량이 25% 급증하여..." 등의 텍스트 분석 결과


# ── 최종 통합 응답 (채민이 받는 형식) ──
class StockAnalysisResponse(BaseModel):
    """
    Critic 에이전트가 3개 에이전트 결과 + 자체 모순 검증을 합쳐서 만드는 최종 응답.
    채민은 이 형식만 보고 프론트엔드를 만들면 됨.

    ⚠️ 알파 팩터 관련 필드는 반드시 아래 규칙을 지킬 것:
    - sentiment_alpha / flow_alpha / financial_alpha / momentum_alpha / composite_alpha는
      전부 백엔드(main.py)가 계산해서 채워주는 "최종값"이다.
    - 프론트엔드는 이 값들을 절대 재계산하지 말고 그대로 표시만 해야 한다.
      (과거에 프론트가 sentiment.positive - sentiment.negative로 감성 알파를
       직접 재계산하면서, 변동성 보정이 반영된 백엔드 값과 어긋나는 버그가 있었음)
    """
    ticker: str
    price: float
    price_history: List[float] = []
    volume_history: List[float] = []
    institution_history: List[float] = []
    foreign_history: List[float] = []
    individual_history: List[float] = []
    investor_data: List[InvestorData] = []
    financial: Optional[FinancialData] = None
    realtime: List[RealtimePrice] = []
    news_uncertainty: Optional[UncertaintyResult] = None  # 뉴스 에이전트 불확실성

    # ── 알파 팩터 (전부 백엔드 계산값, 프론트 재계산 금지) ──
    sentiment_alpha: float = 0.0  # ★[버그 수정] 신규 추가 — 감성 알파 (변동성 보정 완료)
    flow_alpha: float = 0.0       # 수급 알파 팩터
    financial_alpha: float = 0.0  # 재무 알파 팩터
    momentum_alpha: float = 0.0   # 모멘텀 알파 팩터
    composite_alpha: float = 0.0  # 종합 알파 팩터 (감성 30% + 수급 30% + 재무 20% + 모멘텀 20%)

    market_index: Optional[dict] = None  # 코스피/코스닥 지수
    news: List[NewsItem]
    prediction: List[Prediction]  # 변경: 단건 -> 1일 단위 리스트
    sentiment: Sentiment
    warnings: List[str]
    confidence_score: int
    confidence_breakdown: Optional[dict] = None  # 정보/신호/예측/시장 서브스코어 breakdown
    explanation: List[NewsInsight] = []
    trend: Optional[SentimentTrend] = None
    top_keywords: Optional[str] = None
    volatility: Optional[float] = None
    calculation_note: Optional[str] = None  # 긍정/부정 비율 계산 방식 설명 (상세보기용)
    volume_analysis: Optional[str] = None  # 리포트에 들어갈 거래량 분석 요약 문구
    news_agent_report: Optional[str] = None  # 뉴스 에이전트 분석 리포트
    news_agent_confidence: Optional[float] = None  # 뉴스 에이전트 신뢰도
    news_agent_epistemic: Optional[float] = None   # Epistemic 불확실성
    news_agent_aleatoric: Optional[float] = None   # Aleatoric 불확실성
    critic_report: Optional[str] = None  # LLM Critic 에이전트 리포트