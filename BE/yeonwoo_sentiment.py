"""
[감성 분석 및 XAI 레이어 — 담당: 유빈]

1. 한국어/영어 금융 특화 RoBERTa/FinBERT 모델 자동 분기
2. 시간 가중치 + 언론사 신뢰도 결합 가중 감성 점수 산출
3. Leave-one-out 기반 단어별 기여도(XAI) 계산
4. 감성 신호 불명확 / 의견 혼재 등 4대 불확실성 경고 리포팅
"""

import os
import re
import math
from typing import List, Optional
from datetime import datetime, timezone

try:
    from langdetect import detect
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False

from schemas import Sentiment, WordContribution, SentimentResult, SentimentTrend

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# 주요 언론사별 신뢰도 가중치
SOURCE_TRUST = {
    "한국경제": 1.0, "매경": 1.0, "조선비즈": 1.0, "연합뉴스": 1.0,
    "서울경제": 0.9, "이데일리": 0.9, "머니투데이": 0.9, "헤럴드경제": 0.9,
    "bloomberg": 1.0, "reuters": 1.0, "cnbc": 1.0, "wsj": 1.0,
}
DEFAULT_TRUST = 0.6

_pipe_ko = None
_pipe_en = None


def _get_pipe_ko():
    global _pipe_ko
    if _pipe_ko is None:
        from transformers import pipeline
        _pipe_ko = pipeline("text-classification", model="wooo000/roberta-ko-stock", top_k=None)
    return _pipe_ko


def _get_pipe_en():
    global _pipe_en
    if _pipe_en is None:
        from transformers import pipeline
        _pipe_en = pipeline("text-classification", model="wooo000/finbert-en-stock", top_k=None)
    return _pipe_en


def _get_pipe_for(text: str):
    """텍스트 언어 판별 후 적절한 HuggingFace 파이프라인 반환"""
    if HAS_LANGDETECT:
        try:
            lang = detect(text)
            if lang == "en":
                return _get_pipe_en()
        except Exception:
            pass
    return _get_pipe_ko()


def _parse_date(date_str: str) -> datetime:
    """ISO 날짜 포맷 안전 파싱"""
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"]:
        try:
            return datetime.strptime(date_str[:19], fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return datetime.now(timezone.utc)


def _time_weight(news_item) -> float:
    """최신 뉴스일수록 높은 가중치 (오늘=1.0 / 3일전=0.7 / 7일전=0.4 / 그이상=0.2)"""
    pub_dt = _parse_date(news_item.published_at)
    days_old = (datetime.now(timezone.utc) - pub_dt).days
    if days_old <= 1:
        return 1.0
    elif days_old <= 3:
        return 0.7
    elif days_old <= 7:
        return 0.4
    else:
        return 0.2


def _source_weight(news_item) -> float:
    """출처 신뢰도 가중치 (주요 언론사=1.0 / 기타 출처=0.6)"""
    source = getattr(news_item, "source", "") or ""
    for key, weight in SOURCE_TRUST.items():
        if key.lower() in source.lower():
            return weight
    return DEFAULT_TRUST


def _score_one(text: str, pipe) -> float:
    """
    0~1 범위로 감성 점수 반환.
    (1=완전 긍정, 0=완전 부정, 0.5=중립)
    """
    if not text:
        return 0.5
    try:
        result = pipe(text, truncation=True, max_length=512)[0]
        scores = {item["label"].lower(): item["score"] for item in result}
        pos = scores.get("positive", 0)
        neg = scores.get("negative", 0)
        total = pos + neg
        return (pos / total) if total > 0 else 0.5
    except Exception:
        return 0.5


def _explain(text: str, pipe, top_k: int = 4) -> list[dict]:
    """
    XAI — Leave-one-out 방식 단어별 기여도 계산.
    특수문자 정화 적용으로 한국어 조사/특수문자 노이즈 방지.
    """
    if not text:
        return []

    # 문장 부호 및 특수문자 제거 후 단어 추출
    clean_text = re.sub(r'[^\w\s]', '', text)
    words = clean_text.split()

    if len(words) < 2:
        return []

    base = _score_one(text, pipe)
    contribs = []

    for i, word in enumerate(words):
        mod = " ".join(words[:i] + words[i+1:])
        if not mod.strip():
            continue
        contribs.append({
            "word": word,
            "contribution": round(base - _score_one(mod, pipe), 3)
        })

    contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contribs[:top_k]


def analyze(news: list) -> SentimentResult:
    """메인 감성 분석 함수"""
    if USE_MOCK or not news:
        return _get_mock_sentiment()

    pipe = _get_pipe_for(news[0].title)

    # 상위 N개 기사 대상 가중치 산출 및 점수화
    scored = []
    for n in news[:20]:
        score = _score_one(n.title, pipe)
        tw = _time_weight(n)
        sw = _source_weight(n)
        scored.append({
            "news": n,
            "score": score,
            "time_weight": tw,
            "source_weight": sw,
            "combined_weight": tw * sw,
        })

    sentiment = _calc_weighted_sentiment(scored)
    raw_expl = _explain(news[0].title, pipe)
    explanation = [WordContribution(**c) for c in raw_expl]
    warnings = _check_uncertainty(news, sentiment, scored)
    trend = _calc_trend(scored)
    keywords = _extract_keywords(raw_expl)
    volatility = _calc_volatility(scored)

    return SentimentResult(
        sentiment=sentiment,
        explanation=explanation,
        sentiment_warning=" / ".join(warnings) if warnings else None,
        trend=trend,
        top_keywords=keywords,
        volatility=volatility,
    )


def _calc_weighted_sentiment(scored: list[dict]) -> Sentiment:
    """시간 × 언론사 신뢰도 결합 가중 평균 감성 점수 산출"""
    wp = sum(s["score"] * s["combined_weight"] for s in scored)
    tw = sum(s["combined_weight"] for s in scored)
    if tw == 0:
        return Sentiment(positive=0.5, negative=0.5)
    norm_pos = wp / tw
    return Sentiment(positive=round(norm_pos, 3), negative=round(1 - norm_pos, 3))


def _calc_trend(scored: list[dict]) -> Optional[SentimentTrend]:
    """감성 트렌드 분석 — 최근 기사 vs 이전 기사 감성 비교"""
    recent = [s for s in scored if s["time_weight"] >= 0.7]
    old = [s for s in scored if 0.2 <= s["time_weight"] < 0.7]
    if not recent or not old:
        return None

    r = sum(s["score"] for s in recent) / len(recent)
    o = sum(s["score"] for s in old) / len(old)
    change = round(r - o, 3)

    if change > 0.05:
        direction = "긍정 방향으로 개선 중"
    elif change < -0.05:
        direction = "부정 방향으로 악화 중"
    else:
        direction = "보합"

    return SentimentTrend(
        direction=direction,
        recent_score=round(r, 3),
        old_score=round(o, 3),
        change=change,
    )


def _extract_keywords(explanation: list[dict]) -> Optional[str]:
    """XAI 기여도 기반 핵심 긍정/부정 키워드 추출"""
    if not explanation:
        return None
    pos = [e["word"] for e in explanation if e["contribution"] > 0.05][:2]
    neg = [e["word"] for e in explanation if e["contribution"] < -0.05][:2]
    parts = []
    if pos:
        parts.append(f"긍정 키워드: {', '.join(pos)}")
    if neg:
        parts.append(f"부정 키워드: {', '.join(neg)}")
    return " / ".join(parts) if parts else None


def _calc_volatility(scored: list[dict]) -> Optional[float]:
    """기사별 감성 점수 변동성(표준편차) 산출"""
    scores = [s["score"] for s in scored]
    if len(scores) < 2:
        return None
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    return round(math.sqrt(variance), 3)


def _check_uncertainty(news: list, sentiment: Sentiment, scored: list[dict]) -> list[str]:
    """4가지 감성 분석 불확실성 리스크 진단"""
    warnings = []

    # ① 신호 강도 약함
    if abs(sentiment.positive - sentiment.negative) < 0.15:
        warnings.append("감성 신호 불명확")

    # ② 긍/부정 의견 혼재
    if len(scored) >= 3:
        pos_count = sum(1 for s in scored if s["score"] > 0.5)
        if 0.35 <= pos_count / len(scored) <= 0.65:
            warnings.append("긍정·부정 기사 혼재 — 시장 의견 불일치")

    # ③ 수집 뉴스 데이터량 부족
    if len(news) < 5:
        warnings.append(f"뉴스 부족 ({len(news)}건)")
    elif len(news) < 10:
        warnings.append(f"뉴스 적음 ({len(news)}건) — 추가 확인 권장")

    # ④ 최신 정보 미흡
    recent = sum(1 for s in scored if s["time_weight"] >= 0.7)
    if len(scored) > 0 and recent / len(scored) < 0.5:
        warnings.append("최신 뉴스 부족 — 오래된 정보 기반")

    return warnings


def _get_mock_sentiment() -> SentimentResult:
    """테스트용 Mock 데이터"""
    return SentimentResult(
        sentiment=Sentiment(positive=0.65, negative=0.35),
        explanation=[
            WordContribution(word="차세대 양산 계획", contribution=0.31),
            WordContribution(word="반도체 업황 회복", contribution=0.26),
            WordContribution(word="중국 경쟁사 압박", contribution=-0.21),
        ],
        sentiment_warning=None,
        trend=SentimentTrend(
            direction="긍정 방향으로 개선 중",
            recent_score=0.71,
            old_score=0.55,
            change=0.16,
        ),
        top_keywords="긍정 키워드: 차세대 양산, 업황 회복 / 부정 키워드: 경쟁사 압박",
        volatility=0.12,
    )