"""
[감성 분석 및 XAI 레이어 — 담당: 연우]

1. 한국어/영어 금융 특화 RoBERTa/FinBERT 모델 자동 분기
2. 제목 + description 결합 분석으로 정확도 향상
3. 시간 가중치 + 언론사 신뢰도 결합 가중 감성 점수 산출
4. Leave-one-out 기반 단어별 기여도(XAI) 계산
5. 4대 불확실성 경고 리포팅
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

from schemas import Sentiment, WordContribution, SentimentResult, SentimentTrend, AlphaFactor

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# XAI에서 제외할 노이즈 단어 (숫자/단위/일반명사)
XAI_STOPWORDS = {
    "억원", "조원", "만원", "원", "주", "건", "명", "개", "위",
    "관련", "통해", "대한", "위한", "따른", "의한", "이후", "이전",
    "지난", "올해", "내년", "최근", "현재", "오늘", "어제",
    "삼성전자", "sk하이닉스", "하이닉스", "삼성", "전자",
}

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
    """텍스트 언어 판별 후 적절한 파이프라인 반환"""
    if HAS_LANGDETECT:
        try:
            lang = detect(text)
            if lang == "en":
                return _get_pipe_en()
        except Exception:
            pass
    return _get_pipe_ko()


def _parse_date(date_str: str) -> datetime:
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"]:
        try:
            return datetime.strptime(date_str[:19], fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return datetime.now(timezone.utc)


def _time_weight(news_item) -> float:
    """최신 뉴스일수록 높은 가중치"""
    pub_dt = _parse_date(news_item.published_at)
    days_old = (datetime.now(timezone.utc) - pub_dt).days
    if days_old <= 1:   return 1.0
    elif days_old <= 3: return 0.7
    elif days_old <= 7: return 0.4
    else:               return 0.2


def _source_weight(news_item) -> float:
    """출처 신뢰도 가중치"""
    source = getattr(news_item, "source", "") or ""
    for key, weight in SOURCE_TRUST.items():
        if key.lower() in source.lower():
            return weight
    return DEFAULT_TRUST


def _build_text(news_item) -> str:
    """제목 + description 결합 텍스트 생성"""
    title = news_item.title or ""
    desc = getattr(news_item, "description", "") or ""
    # description이 제목과 너무 비슷하면 제목만 사용
    if desc and desc[:20] not in title[:20]:
        return f"{title}. {desc}".strip()
    return title


def _score_one(text: str, pipe) -> float:
    """0~1 범위 감성 점수 반환 (1=긍정, 0=부정)"""
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
    """XAI — Leave-one-out 단어별 기여도 계산"""
    if not text:
        return []

    # 특수문자를 공백으로 바꾼 후 단어 분리 (붙는 현상 방지)
    clean_text = re.sub(r'[^\w\s]', ' ', text)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    words = [w for w in clean_text.split() if len(w) > 1]  # 1글자 단어 제외

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

    # 노이즈 단어 및 숫자/금액 패턴 제외
    contribs = [
        c for c in contribs
        if c["word"].lower() not in XAI_STOPWORDS
        and not re.search(r"[0-9]", c["word"])  # 숫자 포함 단어 제외
        and not c["word"].endswith("은") and not c["word"].endswith("는")
        and not c["word"].endswith("보다") and not c["word"].endswith("에서")
        and len(c["word"]) > 1
    ]
    contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contribs[:top_k]


def analyze(news: list, news_confidence: float = 1.0) -> SentimentResult:
    """메인 함수 — 오케스트레이터가 이 함수만 호출함"""
    if USE_MOCK or not news:
        return _get_mock_sentiment()

    pipe = _get_pipe_for(news[0].title)

    # ── 에이전트 간 메시지 수신 ──
    # 뉴스 에이전트로부터 신뢰도를 받아서 가중치 조정
    if news_confidence < 0.7:
        print(f"📨 뉴스 에이전트 메시지 수신: 신뢰도 {news_confidence:.2f} → 감성 가중치 하향 조정")

    scored = []
    for n in news[:20]:
        # ✨ 제목 + description 결합 텍스트로 분석
        text = _build_text(n)
        score = _score_one(text, pipe)
        tw = _time_weight(n)
        sw = _source_weight(n)
        # ✨ 뉴스 신뢰도가 낮으면 전체 가중치 낮춤
        confidence_weight = news_confidence if news_confidence >= 0.7 else news_confidence * 0.8
        scored.append({
            "news": n,
            "text": text,
            "score": score,
            "time_weight": tw,
            "source_weight": sw,
            "combined_weight": tw * sw * confidence_weight,
        })

    sentiment  = _calc_weighted_sentiment(scored)

    # ✨ 가장 신뢰도 높은 기사 1개로 XAI 분석 (합치면 너무 길어서 기여도 왜곡)
    best = max(scored, key=lambda s: s["combined_weight"])
    raw_expl   = _explain(best["text"], pipe)
    explanation = [WordContribution(**c) for c in raw_expl]

    warnings   = _check_uncertainty(news, sentiment, scored)
    trend      = _calc_trend(scored)
    # Attention 기반 핵심 키워드 추출
    attention_result = _attention_keywords(best["text"], pipe)
    attention_words = [a["word"] for a in attention_result]

    # KeyBERT로 보완
    top_scored = sorted(scored, key=lambda s: s["combined_weight"], reverse=True)[:5]
    kb_texts = [s["text"] for s in top_scored]
    kb_keywords = _extract_keywords_keybert(kb_texts)

    xai_keywords = _extract_keywords(raw_expl)

    # Attention > KeyBERT > XAI 우선순위
    if attention_words:
        keywords = "Attention 키워드: " + ", ".join(attention_words[:5])
    elif kb_keywords:
        keywords = "핵심 키워드: " + ", ".join(kb_keywords)
    else:
        keywords = xai_keywords
    volatility = _calc_volatility(scored)

    # Groq LLM으로 키워드 + 트렌드 + 신뢰도 보완
    llm_result = _llm_sentiment_analysis(news, sentiment)
    if llm_result:
        pos_kw = llm_result.get("positive_keywords", [])
        neg_kw = llm_result.get("negative_keywords", [])
        if pos_kw or neg_kw:
            kw_parts = []
            if pos_kw: kw_parts.append("긍정: " + ", ".join(pos_kw[:3]))
            if neg_kw: kw_parts.append("부정: " + ", ".join(neg_kw[:2]))
            keywords = " / ".join(kw_parts)
        
        # 트렌드 LLM 결과로 보완
        if llm_result.get("trend") and trend is None:
            llm_trend = llm_result.get("trend")
            llm_reason = llm_result.get("trend_reason", "")
            direction = llm_trend
            trend = SentimentTrend(
                direction=direction,
                recent_score=round(sentiment.positive, 3),
                old_score=round(sentiment.positive - 0.05 if llm_trend == "개선" else sentiment.positive + 0.05, 3),
                change=round(0.05 if llm_trend == "개선" else -0.05 if llm_trend == "악화" else 0, 3),
            )
        
        # LLM 신뢰도로 보완
        llm_confidence = llm_result.get("confidence", None)
        llm_summary = llm_result.get("summary", "")
        if llm_summary:
            print(f"📝 LLM 감성 요약: {llm_summary}")
        
        # 감성 경고에 LLM 신뢰도 반영
        if llm_confidence is not None and llm_confidence < 0.5 and not warnings:
            warnings.append(f"LLM 감성 신뢰도 낮음 ({llm_confidence:.0%})")

    # 퀀트 알파 팩터 계산
    alpha = _calc_sentiment_alpha(sentiment, scored, volatility or 0)
    print(f"📈 감성 알파 팩터: {alpha.sentiment_alpha:.3f} ({alpha.signal})")

    return SentimentResult(
        sentiment=sentiment,
        explanation=explanation,
        sentiment_warning=" / ".join(warnings) if warnings else None,
        trend=trend,
        top_keywords=keywords,
        volatility=volatility,
        alpha=alpha,
    )


def _calc_weighted_sentiment(scored: list[dict]) -> Sentiment:
    """시간 × 신뢰도 가중 평균 감성 점수"""
    wp = sum(s["score"] * s["combined_weight"] for s in scored)
    tw = sum(s["combined_weight"] for s in scored)
    if tw == 0:
        return Sentiment(positive=0.5, negative=0.5)
    norm_pos = wp / tw
    return Sentiment(positive=round(norm_pos, 3), negative=round(1 - norm_pos, 3))


def _calc_trend(scored: list[dict]) -> Optional[SentimentTrend]:
    """최근 기사 vs 이전 기사 감성 트렌드 비교"""
    recent = [s for s in scored if s["time_weight"] >= 0.7]
    old    = [s for s in scored if 0.2 <= s["time_weight"] < 0.7]
    if not recent or not old:
        return None

    r = sum(s["score"] for s in recent) / len(recent)
    o = sum(s["score"] for s in old)    / len(old)
    change = round(r - o, 3)

    if change > 0.05:    direction = "긍정 방향으로 개선 중"
    elif change < -0.05: direction = "부정 방향으로 악화 중"
    else:                direction = "보합"

    return SentimentTrend(
        direction=direction,
        recent_score=round(r, 3),
        old_score=round(o, 3),
        change=change,
    )




def _attention_keywords(text: str, pipe, top_k: int = 5) -> list[dict]:
    """
    BERT Attention 기반 핵심 키워드 추출
    모델이 감성 판단할 때 실제로 집중한 단어를 보여줌
    """
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        model_name = pipe.model.config._name_or_path
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name, output_attentions=True
        )
        model.eval()

        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
        with torch.no_grad():
            outputs = model(**inputs)

        # 마지막 레이어 attention 평균 (CLS 기준)
        attentions = outputs.attentions[-1]
        avg_attention = attentions[0].mean(dim=0)[0].tolist()
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])

        # 서브워드 합치기
        merged = {}
        current_word = ""
        current_score = 0.0
        for token, score in zip(tokens[1:-1], avg_attention[1:-1]):
            if token.startswith("##"):
                current_word += token[2:]
                current_score = max(current_score, score)
            else:
                if current_word:
                    merged[current_word] = current_score
                current_word = token
                current_score = score
        if current_word:
            merged[current_word] = current_score

        # 조사/어미/불용어 제거
        ko_stopwords = {
            "의", "에", "을", "를", "이", "가", "은", "는", "와", "과",
            "로", "으로", "에서", "까지", "도", "만", "에게", "한", "하",
            "및", "등", "위해", "통해", "따라", "위한", "대한"
        }

        import re
        cleaned = {}
        for word, score in merged.items():
            # 조사 제거 (끝에 붙은 조사)
            clean = re.sub(r"(에서|으로|에게|까지|에서|이나|이고|하고|이며|지만)$", "", word)
            clean = re.sub(r"(의|에|을|를|이|가|은|는|와|과|로|도|만)$", "", clean)
            if len(clean) > 1 and clean not in ko_stopwords and not re.search(r"[0-9]", clean):
                cleaned[clean] = score

        pairs = sorted(cleaned.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{"word": w, "attention_score": round(s, 4)} for w, s in pairs]

    except Exception as e:
        print(f"⚠️ Attention 분석 실패: {e}")
        return []

def _extract_keywords_keybert(texts: list[str], top_k: int = 5) -> list[str]:
    """KeyBERT로 전체 뉴스에서 핵심 키워드 추출"""
    try:
        from keybert import KeyBERT
        kw_model = KeyBERT()
        combined = " ".join(texts[:10])  # 상위 10개 기사
        keywords = kw_model.extract_keywords(
            combined,
            keyphrase_ngram_range=(1, 2),
            stop_words=None,
            top_n=top_k,
            diversity=0.5
        )
        return [kw for kw, score in keywords if score > 0.2]
    except Exception as e:
        print(f"⚠️ KeyBERT 실패: {e}")
        return []

def _extract_keywords(explanation: list[dict]) -> Optional[str]:
    """XAI 기여도 기반 핵심 키워드 추출"""
    if not explanation:
        return None
    pos = [e["word"] for e in explanation if e["contribution"] > 0.05][:2]
    neg = [e["word"] for e in explanation if e["contribution"] < -0.05][:2]
    parts = []
    if pos: parts.append(f"긍정 키워드: {', '.join(pos)}")
    if neg: parts.append(f"부정 키워드: {', '.join(neg)}")
    return " / ".join(parts) if parts else None


def _calc_volatility(scored: list[dict]) -> Optional[float]:
    """기사별 감성 점수 표준편차"""
    scores = [s["score"] for s in scored]
    if len(scores) < 2:
        return None
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    return round(math.sqrt(variance), 3)


def _check_uncertainty(news: list, sentiment: Sentiment, scored: list[dict]) -> list[str]:
    """4가지 불확실성 경고"""
    warnings = []

    # ① 신호 강도
    if abs(sentiment.positive - sentiment.negative) < 0.15:
        warnings.append("감성 신호 불명확")

    # ② 의견 혼재
    if len(scored) >= 3:
        pos_count = sum(1 for s in scored if s["score"] > 0.5)
        if 0.35 <= pos_count / len(scored) <= 0.65:
            warnings.append("긍정·부정 기사 혼재 — 시장 의견 불일치")

    # ③ 데이터량
    if len(news) < 5:
        warnings.append(f"뉴스 부족 ({len(news)}건)")
    elif len(news) < 10:
        warnings.append(f"뉴스 적음 ({len(news)}건) — 추가 확인 권장")

    # ④ 최신성
    recent = sum(1 for s in scored if s["time_weight"] >= 0.7)
    if len(scored) > 0 and recent / len(scored) < 0.5:
        warnings.append("최신 뉴스 부족 — 오래된 정보 기반")

    return warnings



def _calc_sentiment_alpha(sentiment: Sentiment, scored: list[dict], volatility: float) -> AlphaFactor:
    """
    퀀트 펀드 방식 감성 알파 팩터 계산
    감성 에이전트가 생성하는 알파 신호
    """
    # 감성 알파 (-1 ~ +1)
    sentiment_alpha = round(sentiment.positive - sentiment.negative, 3)

    # 변동성 보정 (변동성 높으면 신호 약화)
    vol_penalty = min(volatility * 2, 0.5) if volatility else 0
    adjusted_alpha = sentiment_alpha * (1 - vol_penalty)

    # 신호 강도
    abs_alpha = abs(adjusted_alpha)
    if abs_alpha >= 0.4:
        signal = "강한매수" if adjusted_alpha > 0 else "강한매도"
    elif abs_alpha >= 0.2:
        signal = "매수" if adjusted_alpha > 0 else "매도"
    else:
        signal = "중립"

    return AlphaFactor(
        sentiment_alpha=round(adjusted_alpha, 3),
        composite_alpha=round(adjusted_alpha, 3),
        signal=signal,
    )


def _llm_sentiment_analysis(news_list: list, sentiment: "Sentiment") -> dict:
    """
    Groq LLM으로 감성 키워드 + 트렌드 + 신뢰도 보완
    FinBERT 점수를 유지하면서 맥락 이해 기반 키워드 추출
    """
    try:
        import os
        from groq import Groq
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env")

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            return {}

        client = Groq(api_key=api_key)

        # 상위 10개 뉴스 제목 + description
        top_news = []
        for n in news_list[:10]:
            title = getattr(n, "title", "")
            desc = getattr(n, "description", "") or ""
            top_news.append(f"- {title} {desc[:50]}")
        news_text = "\n".join(top_news)

        prompt = f"""주식 투자 관점에서 다음 뉴스들을 분석하세요.
현재 감성 분석: 긍정 {sentiment.positive:.1%} / 부정 {sentiment.negative:.1%}

뉴스 목록:
{news_text}

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이 JSON만:
{{
  "positive_keywords": ["키워드1", "키워드2", "키워드3"],
  "negative_keywords": ["키워드1", "키워드2"],
  "trend": "개선" or "악화" or "보합",
  "trend_reason": "한 문장 이유",
  "confidence": 0.0~1.0,
  "summary": "뉴스 전체 흐름 한 문장 요약"
}}"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
        )

        import json, re
        text = response.choices[0].message.content
        # JSON 추출
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {}

    except Exception as e:
        print(f"⚠️ LLM 감성 보완 실패: {e}")
        return {}

def _get_mock_sentiment() -> SentimentResult:
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