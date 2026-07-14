import os
import math
from typing import List, Optional
from datetime import datetime, timezone, timedelta

try:
    from langdetect import detect
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False

from schemas import Sentiment, WordContribution, SentimentResult

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

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


def _get_pipe_for(text):
    if HAS_LANGDETECT:
        try:
            return _get_pipe_en() if detect(text) == "en" else _get_pipe_ko()
        except:
            pass
    return _get_pipe_ko()


def _parse_date(date_str):
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"]:
        try:
            return datetime.strptime(date_str[:19], fmt).replace(tzinfo=timezone.utc)
        except:
            continue
    return datetime.now(timezone.utc)


def _time_weight(news_item):
    days_old = (datetime.now(timezone.utc) - _parse_date(news_item.published_at)).days
    if days_old <= 1:   return 1.0
    elif days_old <= 3: return 0.7
    elif days_old <= 7: return 0.4
    else:               return 0.2


def _source_weight(news_item):
    for key in SOURCE_TRUST:
        if key.lower() in news_item.source.lower():
            return SOURCE_TRUST[key]
    return DEFAULT_TRUST


def _score_one(text, pipe):
    result = pipe(text, truncation=True, max_length=512)[0]
    scores = {item["label"].lower(): item["score"] for item in result}
    pos = scores.get("positive", 0)
    neg = scores.get("negative", 0)
    total = pos + neg
    return (pos / total) if total > 0 else 0.5


def _explain(text, pipe, top_k=4):
    words = text.split()
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


def analyze(news):
    if USE_MOCK or not news:
        return _get_mock_sentiment()

    pipe = _get_pipe_for(news[0].title)

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

    sentiment   = _calc_weighted_sentiment(scored)
    raw_expl    = _explain(news[0].title, pipe)
    explanation = [WordContribution(word=c["word"], contribution=c["contribution"]) for c in raw_expl]
    warnings    = _check_uncertainty(news, sentiment, scored)

    return SentimentResult(
        sentiment=sentiment,
        explanation=explanation,
        sentiment_warning=" / ".join(warnings) if warnings else None,
    )


def _calc_weighted_sentiment(scored):
    wp = sum(s["score"] * s["combined_weight"] for s in scored)
    tw = sum(s["combined_weight"] for s in scored)
    if tw == 0:
        return Sentiment(positive=0.5, negative=0.5)
    norm_pos = wp / tw
    return Sentiment(positive=round(norm_pos, 3), negative=round(1 - norm_pos, 3))


def _check_uncertainty(news, sentiment, scored):
    warnings = []
    if abs(sentiment.positive - sentiment.negative) < 0.15:
        warnings.append("감성 신호 불명확")
    if len(scored) >= 3:
        pos_count = sum(1 for s in scored if s["score"] > 0.5)
        if 0.35 <= pos_count / len(scored) <= 0.65:
            warnings.append("긍정·부정 기사 혼재 — 시장 의견 불일치")
    if len(news) < 5:
        warnings.append(f"뉴스 부족 ({len(news)}건)")
    elif len(news) < 10:
        warnings.append(f"뉴스 적음 ({len(news)}건) — 추가 확인 권장")
    recent = sum(1 for s in scored if s["time_weight"] >= 0.7)
    if len(scored) > 0 and recent / len(scored) < 0.5:
        warnings.append("최신 뉴스 부족 — 오래된 정보 기반")
    return warnings


def _get_mock_sentiment():
    return SentimentResult(
        sentiment=Sentiment(positive=0.65, negative=0.35),
        explanation=[
            WordContribution(word="차세대 양산 계획", contribution=0.31),
            WordContribution(word="반도체 업황 회복", contribution=0.26),
            WordContribution(word="중국 경쟁사 압박", contribution=-0.21),
            WordContribution(word="삼성전자", contribution=0.06),
        ],
        sentiment_warning=None,
    )
