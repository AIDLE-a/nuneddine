"""
[담당: 연우]
FinBERT 감성분석 + XAI 설명(Leave-one-out)을 담당.
스스로 "감성 불확실성"을 판단해서 같이 반환.

✅ 이 파일만 채우면 됨. 반환 형식(SentimentResult)은 절대 바꾸지 말 것.
✅ 코랩에서 먼저 테스트한 로직을 _run_finbert()에 그대로 옮기면 됨.
"""
import os
from schemas import SentimentResult, Sentiment, WordContribution, NewsItem
from yeonwoo_xai import explain_sentiment

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

_pipe = None


def _get_pipe():
    global _pipe
    if _pipe is None:
        from transformers import pipeline
        _pipe = pipeline("text-classification", model="wooo000/kr-finbert-stock-finetuned", top_k=None)
    return _pipe


def analyze(news: list[NewsItem]) -> SentimentResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK or not news:
        return _get_mock_sentiment()

    pipe = _get_pipe()
    sentiment = _run_finbert(news, pipe)
    main_text = news[0].title
    explanation = explain_sentiment(main_text, pipe)
    sentiment_warning = _check_sentiment_uncertainty(sentiment, news_count=len(news))

    return SentimentResult(
        sentiment=sentiment,
        explanation=explanation,
        sentiment_warning=sentiment_warning,
    )


def _run_finbert(news: list[NewsItem], pipe) -> Sentiment:
    """뉴스 전체에 대해 FinBERT 감성 분석 평균 계산.
    제목만으로는 신호가 약할 수 있어, 요약문(description)이 있으면 같이 합쳐서 분석한다.
    (NewsItem에 description 필드가 없는 경우를 대비해 getattr로 안전하게 접근)
    """
    texts = []
    for n in news[:20]:
        desc = getattr(n, "description", "") or ""
        combined = f"{n.title}. {desc}".strip() if desc else n.title
        texts.append(combined)
    results = pipe(texts, truncation=True, max_length=512)

    pos_scores, neg_scores = [], []
    for result in results:
        for item in result:
            if item["label"].lower() == "positive":
                pos_scores.append(item["score"])
            elif item["label"].lower() == "negative":
                neg_scores.append(item["score"])

    avg_pos = sum(pos_scores) / len(pos_scores) if pos_scores else 0
    avg_neg = sum(neg_scores) / len(neg_scores) if neg_scores else 0
    return Sentiment(positive=round(avg_pos, 3), negative=round(avg_neg, 3))


def _check_sentiment_uncertainty(sentiment: Sentiment, news_count: int = 0) -> str | None:
    """감성 에이전트 스스로의 불확실성 판단 — 신호가 명확하고, 표본도 충분한가?"""
    if news_count and news_count < 5:
        return "표본 부족으로 감성 신뢰도 낮음"
    if abs(sentiment.positive - sentiment.negative) < 0.15:
        return "감성 신호 불명확"
    return None


def _get_mock_sentiment() -> SentimentResult:
    sentiment = Sentiment(positive=0.62, negative=0.31)
    return SentimentResult(
        sentiment=sentiment,
        explanation=[
            WordContribution(word="차세대 양산 계획", contribution=0.31),
            WordContribution(word="반도체 업황 회복", contribution=0.26),
            WordContribution(word="중국 경쟁사 압박", contribution=-0.21),
            WordContribution(word="삼성전자", contribution=0.06),
        ],
        sentiment_warning=_check_sentiment_uncertainty(sentiment),
    )