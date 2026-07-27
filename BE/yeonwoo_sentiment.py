"""
[감성 분석 및 XAI 레이어 — 담당: 연우]

1. 한국어/영어 금융 특화 RoBERTa/FinBERT 모델 자동 분기
2. 시간 가중치 + 언론사 신뢰도 결합 가중 감성 점수 산출
3. LLM 기반 종합 브리핑, 호재/악재 뉴스 분리 및 뉴스 칩(Chip) 생성
4. 불확실성 경고 및 알파 요소 산출

⚠️ 수정 노트:
   1) LLM에 제목만 주던 것 → description도 함께 제공해서 근거를 좁힘
   2) 프롬프트에 "원문에 없는 정보는 만들어내지 말 것" 명시 → 수치 환각 방지
   3) LLM 호출 실패/파싱 실패 시 FinBERT XAI 기반 폴백 추가
      → LLM이 죽어도 화면이 완전히 비지 않고 최소한의 분석 결과를 보여줌
      (팀 컨셉 "AI가 자기 한계를 아는 시스템"과 일치)
   4) [★추가] 폴백 로직을 "기사 1개 내 단어 기여도"에서 "기사 여러 개 중 호재/악재
      기사를 각각 선정"하는 방식으로 변경
      → 이전에는 카드 2개가 항상 같은 기사에서 나와서 중복/편향 문제가 있었음
   5) [★추가] 폴백 카드의 메인 문구를 원본 뉴스 제목 그대로 노출하지 않고,
      XAI로 뽑은 키워드(chips)를 조합한 합성 문장으로 대체
      (예: "HBM 공급·AI 투자 관련 이슈로 긍정적 신호")
      원본 제목은 source_title로 분리해 출처 캡션/링크 용도로만 사용
   6) [★추가 2] LLM 성공 경로에서 source_title이 빠져있어서 프론트에서
      링크/출처 캡션이 안 뜨던 문제 수정 → url로 원본 뉴스를 찾아 source_title 채움
   7) [★추가 2] 프롬프트의 "1~2개" 제한을 "최대 4개"로 완화 → 상세보기 개수 확장
   8) [★추가 3] 항목 개수가 늘어나면서 LLM이 만드는 JSON에 콤마 누락 등
      문법 오류가 생겨 파싱(json.loads) 실패가 발생 → Groq의 response_format
      JSON 모드를 강제해서 모델이 유효한 JSON만 생성하도록 하고,
      혹시 그래도 깨질 경우를 대비해 trailing comma 등 흔한 오류를
      자동 보정하는 _safe_json_parse()를 추가
   9) [★추가 4] "AI 총평이 매번 같은 문구(=폴백 템플릿)만 뜨는" 문제 진단/보강:
      a) GROQ_API_KEY가 없을 때 기존엔 아무 로그도 안 남기고 조용히 폴백으로
         빠졌음 → 이제 print로 명확히 남겨서 "왜 매번 실패하는지" 콘솔에서
         바로 확인 가능하게 함
      b) Groq가 2026-08-16에 llama-3.1-8b-instant를 종료 예정이라고 공지함
         (대체 모델: openai/gpt-oss-20b, https://console.groq.com/docs/deprecations)
         → 1차 모델 호출이 실패하면 대체 모델로 자동 재시도하도록 구성해서,
         종료일이 지나도 이 파일을 다시 안 고쳐도 되게 함
      c) 각 모델 시도마다 실패 사유(예외 타입 + 메시지)를 그대로 로그에 남겨서
         다음에 실패하면 콘솔에서 바로 원인을 볼 수 있게 함
   10) [★추가 5] 실제 로그로 원인 2가지 확인 후 조치:
      a) llama-3.1-8b-instant가 분당 토큰 한도(TPM 6000)를 계속 초과 (429) →
         프롬프트에 넣는 뉴스 개수/설명 길이와 max_tokens를 줄여 요청당
         토큰 사용량을 낮춤. (Critic 에이전트 등 같은 Groq 계정을 쓰는 다른
         호출과 쿼터를 나눠 쓰기 때문에 완전히 없앨 순 없고, 빈도만 낮춤)
      b) 대체 모델 openai/gpt-oss-20b가 response_format=json_object 강제 모드와
         궁합이 안 좋아 매번 400(json_validate_failed, failed_generation 빈 값)로
         실패 — reasoning 계열 모델이 JSON 앞뒤로 reasoning 텍스트를 섞어
         내보내면서 Groq의 엄격 검증에 걸리는 것으로 보임. 이 모델에는
         response_format을 강제하지 않고, 대신 이미 있는 _safe_json_parse()의
         정규식 추출로 파싱하도록 모델별로 분기
   11) [★추가 6] "AI 총평이 종목과 무관하게 매번 똑같은 문장"으로 뜨는 버그의
       진짜 원인 확인: LLM 호출 자체는 성공하고 있었는데, 프롬프트의 JSON
       예시에 넣어둔 "최근 장중 상승 등 강력한 수급 모멘텀이..." 문장이 너무
       그럴듯한 실제 문장이라, temperature=0.1(사실상 결정론적)인 작은 모델이
       "형식 예시"가 아니라 "정답"으로 착각해 그대로 복사해서 반환하는 현상
       발견 → ① 예시를 <...> 꺾쇠 형태의 명백한 placeholder로 교체하고
       "예시를 그대로 복사하지 말 것"을 명시 ② 그래도 예시 문장을 그대로
       반환하면 파싱 직후 감지해서 무효 처리하고 다음 모델로 재시도하도록
       _is_prompt_example_copy() 방어 로직 추가
"""

import os
import re
import math
import json
from typing import List, Optional
from datetime import datetime, timezone

try:
    from langdetect import detect
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False

from schemas import Sentiment, WordContribution, SentimentResult, SentimentTrend, AlphaFactor

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

SOURCE_TRUST = {
    "한국경제": 1.0, "매경": 1.0, "조선비즈": 1.0, "연합뉴스": 1.0,
    "서울경제": 0.9, "이데일리": 0.9, "머니투데이": 0.9, "헤럴드경제": 0.9,
    "bloomberg": 1.0, "reuters": 1.0, "cnbc": 1.0, "wsj": 1.0,
}
DEFAULT_TRUST = 0.6

# ── 폴백 XAI에서 제외할 노이즈 단어 ──
XAI_STOPWORDS = {
    "억원", "조원", "만원", "원", "주", "건", "명", "개", "위",
    "관련", "통해", "대한", "위한", "따른", "의한", "이후", "이전",
    "지난", "올해", "내년", "최근", "현재", "오늘", "어제",
    "필요", "놓고", "검증", "충분한", "및", "등", "이번", "가운데",
}
_JOSA_PATTERN_1 = r"(에서|으로|에게|까지|이나|이고|하고|이며|지만)$"
_JOSA_PATTERN_2 = r"(의|에|을|를|이|가|은|는|와|과|로|도|만|인)$"

# ── 폴백 호재/악재 선정 기준 ──
MAX_ITEMS_PER_SIDE = 5      # 호재/악재 각각 최대 몇 개까지 후보로 뽑을지 (프론트 "더보기" 탭용)
MIN_CORPUS_DOCS_FOR_STOPWORDS = 5  # 이 개수 미만이면 corpus stopword 필터를 건너뜀 (과필터링 방지)
CORPUS_STOPWORD_MIN_RATIO = 0.6    # 0.35 → 0.6으로 완화 (진짜 공통 단어만 제외)

# [★추가 4] Groq 모델 후보 목록 — 1차가 실패(만료/에러/빈 응답)하면 순서대로 재시도.
# llama-3.1-8b-instant는 2026-08-16 종료 예정 공지 → openai/gpt-oss-20b가 공식 대체 모델.
# [★추가 5] 모델별로 response_format(json_object 강제) 사용 여부를 다르게 둠.
# gpt-oss-20b는 강제 JSON 모드에서 계속 400(json_validate_failed)이 나서 꺼둠 —
# 대신 _safe_json_parse()의 정규식 추출에 맡김.
GROQ_MODEL_CANDIDATES = [
    {"model": "llama-3.1-8b-instant", "force_json_mode": True},
    {"model": "openai/gpt-oss-20b", "force_json_mode": False},
]

# [★추가 6] 프롬프트 예시에 있던 문장 — 모델이 이 문장을 "그대로" 반환하면
# 형식 예시를 복사한 것으로 간주하고 무효 처리한다.
_PROMPT_EXAMPLE_SUMMARY = (
    "최근 장중 상승 등 강력한 수급 모멘텀이 유지되고 있으나, "
    "차익실현 매물 출회로 인한 단기 변동성이 공존하고 있습니다."
)

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
    pub_dt = _parse_date(news_item.published_at)
    days_old = (datetime.now(timezone.utc) - pub_dt).days
    if days_old <= 1:   return 1.0
    elif days_old <= 3: return 0.7
    elif days_old <= 7: return 0.4
    else:               return 0.2


def _source_weight(news_item) -> float:
    source = getattr(news_item, "source", "") or ""
    for key, weight in SOURCE_TRUST.items():
        if key.lower() in source.lower():
            return weight
    return DEFAULT_TRUST


def _build_text(news_item) -> str:
    title = news_item.title or ""
    desc = getattr(news_item, "description", "") or ""
    if desc and desc[:20] not in title[:20]:
        return f"{title}. {desc}".strip()
    return title


def _score_one(text: str, pipe) -> float:
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


def _strip_josa(word: str) -> str:
    """단어 끝에 붙은 한국어 조사를 제거 (폴백 XAI용)"""
    clean = re.sub(_JOSA_PATTERN_1, "", word)
    clean = re.sub(_JOSA_PATTERN_2, "", clean)
    return clean


def _clean_title(title: str, max_len: int = 40) -> str:
    """뉴스 제목에서 언론사명/블로그명 접미사를 제거하고 길이를 다듬음 (출처 캡션용)"""
    if not title:
        return title
    cleaned = re.sub(r"\s*[-:|]\s*[^\-:|]{1,15}$", "", title).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip() + "..."
    return cleaned


def _compute_corpus_stopwords(scored: list[dict], min_ratio: float = CORPUS_STOPWORD_MIN_RATIO) -> set:
    if len(scored) < MIN_CORPUS_DOCS_FOR_STOPWORDS:
        return set()

    from collections import Counter
    doc_word_sets = []
    for s in scored:
        clean_text = re.sub(r'[^\w\s]', ' ', s["text"])
        words = {_strip_josa(w) for w in clean_text.split() if len(w) > 1}
        doc_word_sets.append(words)

    n = len(doc_word_sets)
    counter = Counter()
    for words in doc_word_sets:
        for w in words:
            counter[w] += 1

    return {w for w, c in counter.items() if c / n >= min_ratio}


def _build_calculation_note(scored: list[dict], news_confidence: float, total_news_count: int) -> str:
    n = len(scored)
    if n == 0:
        return "분석에 사용된 뉴스가 없습니다."
    avg_source_weight = round(sum(s["source_weight"] for s in scored) / n, 2)
    avg_time_weight = round(sum(s["time_weight"] for s in scored) / n, 2)

    count_note = (
        f"총 {total_news_count}건의 뉴스 중 최신순 상위 {n}건을 분석했습니다."
        if total_news_count > n
        else f"총 {n}건의 뉴스를 분석했습니다."
    )
    return (
        f"{count_note} 각 뉴스는 ① 발행 시점이 최근일수록 높은 가중치"
        f"(1일 이내 1.0배 → 7일 이후 0.2배), ② 언론사 신뢰도(이번 분석 평균 {avg_source_weight}배), "
        f"③ 뉴스 수집 신뢰도({round(news_confidence, 2)}배)를 곱해 가중치를 매긴 뒤, "
        f"긍정/부정 점수를 가중 평균하여 비율을 산출합니다. "
        f"(이번 분석의 평균 시간 가중치: {avg_time_weight})"
    )


def _build_reason_text(chips: list[str], is_positive: bool) -> str:
    """XAI로 뽑은 키워드(chips)를 조합해 '왜 호재/악재인지' 문장을 합성 (LLM 없이)"""
    if not chips:
        return "긍정적 신호 감지" if is_positive else "부정적 신호 감지"
    keyword_str = "·".join(chips)
    return f"{keyword_str} 관련 이슈로 {'긍정적' if is_positive else '부정적'} 신호"


def _dedup_by_title(items: list[dict], limit: int) -> list[dict]:
    """같은 기사가 중복으로 뽑히는 것 방지"""
    seen = set()
    result = []
    for it in items:
        title = it["news"].title
        if title in seen:
            continue
        seen.add(title)
        result.append(it)
        if len(result) >= limit:
            break
    return result


def _explain_fallback(text: str, pipe, top_k: int = 2, extra_stopwords: set = frozenset()) -> list[dict]:
    """
    LLM 실패 시 사용하는 FinBERT Leave-one-out 기반 폴백 XAI.
    LLM만큼 풍부하진 않지만, 최소한 근거 있는 단어 기여도를 보여줌.

    extra_stopwords: [★추가] 종목명처럼 거의 모든 기사에 공통으로 등장해서
    변별력이 없는 단어들을 추가로 제외하기 위한 집합.
    """
    if not text:
        return []

    clean_text = re.sub(r'[^\w\s]', ' ', text)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    words = [w for w in clean_text.split() if len(w) > 1]

    if len(words) < 2:
        return []

    base = _score_one(text, pipe)
    contribs = []

    for i, word in enumerate(words):
        mod = " ".join(words[:i] + words[i+1:])
        if not mod.strip():
            continue
        display_word = _strip_josa(word)
        contribs.append({
            "word": display_word,
            "contribution": round(base - _score_one(mod, pipe), 3)
        })

    contribs = [
        c for c in contribs
        if c["word"].lower() not in XAI_STOPWORDS
        and c["word"] not in extra_stopwords
        and not re.search(r"[0-9]", c["word"])
        and len(c["word"]) > 1
        and not (c["word"].isascii() and len(c["word"]) <= 3)
    ]
    contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contribs[:top_k]


def analyze(news: list, news_confidence: float = 1.0) -> SentimentResult:
    """메인 감성 분석 함수"""
    if USE_MOCK or not news:
        return _get_mock_sentiment()

    pipe = _get_pipe_for(news[0].title)

    scored = []
    for n in news[:20]:
        text = _build_text(n)
        score = _score_one(text, pipe)
        tw = _time_weight(n)
        sw = _source_weight(n)
        confidence_weight = news_confidence if news_confidence >= 0.7 else news_confidence * 0.8
        scored.append({
            "news": n,
            "text": text,
            "score": score,
            "time_weight": tw,
            "source_weight": sw,
            "combined_weight": tw * sw * confidence_weight,
        })

    sentiment = _calc_weighted_sentiment(scored)
    calculation_note = _build_calculation_note(scored, news_confidence, total_news_count=len(news))  # [★추가]

    # Groq LLM으로 AI 종합 브리핑, 호재/악재 뉴스 구분 및 뉴스 칩 생성
    llm_analysis = _llm_sentiment_analysis(news, sentiment)

    warnings = _check_uncertainty(news, sentiment, scored)
    trend = _calc_trend(scored)
    volatility = _calc_volatility(scored)
    alpha = _calc_sentiment_alpha(sentiment, scored, volatility or 0)

    has_llm_result = bool(
        llm_analysis and (llm_analysis.get("positive_items") or llm_analysis.get("negative_items"))
    )

    if has_llm_result:
        # ── LLM 브리핑 성공 ──
        # [★추가 2] url 기준으로 원본 뉴스 객체를 찾아 source_title을 채워줌.
        # 이게 없으면 프론트(InsightItem)에서 출처 캡션/링크 표시 UI가 아예 그려지지 않음.
        news_by_url = {getattr(n, "url", None): n for n in news if getattr(n, "url", None)}

        def _resolve_source_title(item_url: str) -> Optional[str]:
            matched = news_by_url.get(item_url)
            return _clean_title(matched.title) if matched else None

        explanation = []
        if llm_analysis.get("positive_items"):
            for item in llm_analysis["positive_items"]:
                item_url = item.get("url", "#")
                explanation.append({
                    "type": "positive",
                    "title": item.get("title", ""),
                    "source_title": _resolve_source_title(item_url),  # [★추가 2]
                    "chips": item.get("chips", []),
                    "url": item_url
                })
        if llm_analysis.get("negative_items"):
            for item in llm_analysis["negative_items"]:
                item_url = item.get("url", "#")
                explanation.append({
                    "type": "negative",
                    "title": item.get("title", ""),
                    "source_title": _resolve_source_title(item_url),  # [★추가 2]
                    "chips": item.get("chips", []),
                    "url": item_url
                })
        top_keywords = llm_analysis.get("ai_summary", "뉴스 데이터를 종합 분석 중입니다.")

    else:
        # ── LLM 실패 시 폴백: 기사 단위로 호재/악재 뉴스를 각각 선정 ──
        print("⚠️ LLM 브리핑 생성 실패 — FinBERT XAI 폴백으로 전환")

        corpus_stopwords = _compute_corpus_stopwords(scored)

        # 절대 임계값 대신, 0.5를 기준으로 상/하위 점수를 그냥 뽑는 방식.
        # 기사 점수가 다 애매하게 몰려있어도 "상대적으로 더 긍정/부정적인" 기사를
        # 항상 골라낼 수 있음.
        pos_sorted = sorted(scored, key=lambda s: s["score"], reverse=True)
        neg_sorted = sorted(scored, key=lambda s: s["score"])

        positive_candidates = _dedup_by_title(
            [s for s in pos_sorted if s["score"] > 0.5], MAX_ITEMS_PER_SIDE
        )
        negative_candidates = _dedup_by_title(
            [s for s in neg_sorted if s["score"] < 0.5], MAX_ITEMS_PER_SIDE
        )

        used_reason_texts = set()

        def _build_items(candidates, is_positive):
            items = []
            for cand in candidates:
                raw_expl = _explain_fallback(
                    cand["text"], pipe, top_k=3, extra_stopwords=corpus_stopwords
                )
                if not raw_expl:
                    continue

                chosen_chips, reason_text = None, None
                for k in (2, 3, 1):
                    if k > len(raw_expl):
                        continue
                    candidate_chips = [c["word"] for c in raw_expl[:k]]
                    candidate_text = _build_reason_text(candidate_chips, is_positive)
                    if candidate_text not in used_reason_texts:
                        chosen_chips, reason_text = candidate_chips, candidate_text
                        break

                if reason_text is None:
                    continue

                used_reason_texts.add(reason_text)
                items.append({
                    "type": "positive" if is_positive else "negative",
                    "title": reason_text,
                    "source_title": _clean_title(cand["news"].title),
                    "chips": chosen_chips,
                    "url": getattr(cand["news"], "url", "#"),
                })
            return items

        explanation = _build_items(positive_candidates, True) + _build_items(negative_candidates, False)

        if not explanation:
            best = max(scored, key=lambda s: s["combined_weight"])
            explanation.append({
                "type": "neutral",
                "title": "뚜렷한 호재/악재 신호 없음",
                "source_title": _clean_title(best["news"].title),
                "chips": [],
                "url": getattr(best["news"], "url", "#"),
            })

        top_keywords = (
            "AI 브리핑 생성에 실패하여 기본 분석으로 대체되었습니다. "
            f"긍정 {round(sentiment.positive*100)}% / 부정 {round(sentiment.negative*100)}%"
        )
        if not warnings:
            warnings = []
        warnings.append("LLM 브리핑 생성 실패 — 기본 분석 결과로 대체됨")

    return SentimentResult(
        sentiment=sentiment,
        explanation=explanation,
        sentiment_warning=" / ".join(warnings) if warnings else None,
        trend=trend,
        top_keywords=top_keywords,
        volatility=volatility,
        alpha=alpha,
        calculation_note=calculation_note,  # [★추가]
    )


def _calc_weighted_sentiment(scored: list[dict]) -> Sentiment:
    wp = sum(s["score"] * s["combined_weight"] for s in scored)
    tw = sum(s["combined_weight"] for s in scored)
    if tw == 0:
        return Sentiment(positive=0.5, negative=0.5)
    norm_pos = wp / tw
    return Sentiment(positive=round(norm_pos, 3), negative=round(1 - norm_pos, 3))


def _calc_trend(scored: list[dict]) -> Optional[SentimentTrend]:
    recent = [s for s in scored if s["time_weight"] >= 0.7]
    old = [s for s in scored if 0.2 <= s["time_weight"] < 0.7]
    if not recent or not old:
        return None

    r = sum(s["score"] for s in recent) / len(recent)
    o = sum(s["score"] for s in old) / len(old)
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


def _calc_volatility(scored: list[dict]) -> Optional[float]:
    scores = [s["score"] for s in scored]
    if len(scores) < 2:
        return None
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    return round(math.sqrt(variance), 3)


def _check_uncertainty(news: list, sentiment: Sentiment, scored: list[dict]) -> list[str]:
    warnings = []
    if abs(sentiment.positive - sentiment.negative) < 0.15:
        warnings.append("감성 신호 불명확")
    if len(news) < 5:
        warnings.append(f"뉴스 부족 ({len(news)}건)")
    return warnings


def _calc_sentiment_alpha(sentiment: Sentiment, scored: list[dict], volatility: float) -> AlphaFactor:
    sentiment_alpha = round(sentiment.positive - sentiment.negative, 3)
    vol_penalty = min(volatility * 2, 0.5) if volatility else 0
    adjusted_alpha = sentiment_alpha * (1 - vol_penalty)
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


def _safe_json_parse(raw_text: str) -> dict:
    """
    [★추가 3] LLM이 만든 JSON의 흔한 문법 오류를 보정해서 파싱 시도.
    1) 그대로 파싱 시도
    2) 실패하면 trailing comma(배열/객체 닫기 직전의 불필요한 콤마) 제거 후 재시도
    3) 그래도 실패하면 원본 텍스트에서 가장 바깥쪽 {...} 블록만 잘라내서 재시도
    4) 모두 실패하면 빈 딕셔너리 반환 (호출부에서 폴백으로 전환됨)
    """
    if not raw_text:
        return {}

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    fixed = re.sub(r',\s*([\]}])', r'\1', raw_text)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if match:
        fixed_block = re.sub(r',\s*([\]}])', r'\1', match.group())
        try:
            return json.loads(fixed_block)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON 파싱 최종 실패: {e}")
            return {}

    return {}


def _is_prompt_example_copy(parsed: dict) -> bool:
    """
    [★추가 6] LLM이 프롬프트 안의 JSON "형식 예시"를 실제 값으로 착각해서
    그대로 복사해 반환했는지 감지.
    현재는 ai_summary 문장이 예시와 완전히 동일한지로 판별.
    (필요하면 나중에 positive_items/negative_items의 예시 title/chips도
    같은 방식으로 검사에 추가할 수 있음)
    """
    if not parsed:
        return False
    summary = (parsed.get("ai_summary") or "").strip()
    return summary == _PROMPT_EXAMPLE_SUMMARY


def _llm_sentiment_analysis(news_list: list, sentiment: Sentiment) -> dict:
    """
    Groq LLM으로 종합 브리핑 + 호재/악재 뉴스 분리 + 키워드 칩 생성.

    ⚠️ 수정: 제목뿐 아니라 description도 함께 제공해서 LLM이 근거 있는
    요약을 만들도록 하고, "원문에 없는 정보는 만들어내지 말라"는 제약을 명시해
    수치·사실 환각(hallucination) 위험을 줄임.

    [★추가 4] GROQ_API_KEY 누락 시 로그를 남기고, 1차 모델이 실패하면
    GROQ_MODEL_CANDIDATES의 다음 모델로 자동 재시도.

    [★추가 6] 응답이 프롬프트 예시 문장을 그대로 복사한 것이면 무효 처리하고
    다음 모델 후보로 넘어감 (모든 후보가 예시만 복사하면 최종적으로 폴백).
    """
    try:
        from groq import Groq
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env")

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            print("⚠️ GROQ_API_KEY가 .env에 없습니다 — LLM 브리핑을 건너뛰고 폴백으로 전환합니다.")
            return {}

        client = Groq(api_key=api_key)

        # TPM 429를 자주 맞아서 뉴스 개수/설명 길이를 줄여 요청 토큰을 절감
        news_items_text = []
        for idx, n in enumerate(news_list[:6]):
            title = getattr(n, "title", "")
            desc = getattr(n, "description", "") or ""
            url = getattr(n, "url", "#")
            entry = f"{idx+1}. 제목: {title}"
            if desc:
                entry += f"\n   내용: {desc[:100]}"
            entry += f"\n   URL: {url}"
            news_items_text.append(entry)

        news_text = "\n".join(news_items_text)

        # [★추가 6] JSON 예시를 "이건 형식일 뿐"이라는 게 명백한 <...> placeholder로
        # 교체. 기존엔 실제로 그럴듯한 완성 문장이라 작은 모델이 정답으로 착각하고
        # 그대로 복사해서 반환하는 문제가 있었음.
        prompt = f"""주식 투자 분석가로서 아래 뉴스 목록을 분석하세요.

[뉴스 목록]
{news_text}

[작성 지침]
1. `ai_summary`: 뉴스 전체 흐름을 1~2문장으로 종합 요약하세요.
2. `positive_items`: 주가에 호재가 되는 대표 뉴스를 최대 4개까지 고르고, 각 뉴스마다 핵심 요약 키워드 태그(chips) 2개를 뽑으세요.
3. `negative_items`: 주가에 악재가 되는 대표 뉴스를 최대 4개까지 고르고, 각 뉴스마다 핵심 요약 키워드 태그(chips) 2개를 뽑으세요.
4. 호재/악재로 분류할 만한 뉴스가 그만큼 없으면 있는 만큼만 담고, 없으면 빈 배열([])로 두세요. 개수를 채우려고 억지로 만들지 마세요.
5. positive_items, negative_items 각 항목의 `url`은 반드시 위 [뉴스 목록]에 실제로 주어진 URL 중 하나를 그대로 복사해서 넣으세요. 새로 만들거나 변형하지 마세요.

[중요 — 반드시 지킬 것]
- 반드시 위에 주어진 제목과 내용에 명시된 정보만 사용하세요.
- 숫자, 퍼센트, 날짜 등 구체적 수치는 원문에 실제로 등장하는 것만 인용하세요. 원문에 없는 수치는 절대 만들어내지 마세요.
- 뉴스 목록이 종목과 무관해 보이면(예: 스포츠, 연예 뉴스), positive_items와 negative_items를 모두 빈 배열로 두고 ai_summary에 "관련 뉴스가 부족합니다"라고 명시하세요.
- 아래 JSON은 "형식"을 보여주는 예시일 뿐입니다. <...> 로 표시된 부분은 절대 그대로 복사하지 말고,
  반드시 위 [뉴스 목록]의 실제 내용을 바탕으로 새로 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "ai_summary": "<위 뉴스 내용을 바탕으로 1~2문장 요약을 새로 작성>",
  "positive_items": [
    {{
      "title": "<위 뉴스 목록 중 호재가 되는 뉴스의 실제 제목>",
      "chips": ["<핵심 키워드1>", "<핵심 키워드2>"],
      "url": "<위 뉴스 목록에 실제로 있는 URL 그대로>"
    }}
  ],
  "negative_items": [
    {{
      "title": "<위 뉴스 목록 중 악재가 되는 뉴스의 실제 제목>",
      "chips": ["<핵심 키워드1>", "<핵심 키워드2>"],
      "url": "<위 뉴스 목록에 실제로 있는 URL 그대로>"
    }}
  ]
}}"""

        # 모델 후보를 순서대로 시도. llama-3.1-8b-instant가 2026-08-16 종료 예정이므로,
        # 실패하면 openai/gpt-oss-20b로 자동 폴백.
        last_error = None
        for candidate in GROQ_MODEL_CANDIDATES:
            model_id = candidate["model"]
            try:
                kwargs = dict(
                    model=model_id,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=0.1,
                )
                if candidate.get("force_json_mode"):
                    kwargs["response_format"] = {"type": "json_object"}

                response = client.chat.completions.create(**kwargs)
                raw_content = response.choices[0].message.content
                parsed = _safe_json_parse(raw_content)

                if parsed and _is_prompt_example_copy(parsed):
                    # [★추가 6] 예시 문장을 그대로 베낀 응답은 무효 처리하고 다음 모델로
                    last_error = f"'{model_id}' 응답이 프롬프트 예시를 그대로 복사함 — 무효 처리"
                    print(f"⚠️ {last_error} — 다음 후보 모델로 재시도")
                    continue

                if parsed:
                    return parsed

                last_error = f"'{model_id}' 응답을 JSON으로 파싱하지 못함 (일부: {raw_content[:200]!r})"
                print(f"⚠️ {last_error}")
            except Exception as model_err:
                last_error = f"'{model_id}' 호출 실패: {type(model_err).__name__}: {model_err}"
                print(f"⚠️ {last_error} — 다음 후보 모델로 재시도")
                continue

        print(f"⚠️ 모든 LLM 모델 시도 실패. 마지막 원인: {last_error}")
        return {}

    except Exception as e:
<<<<<<< HEAD
        print(f"⚠️ LLM 분석 중 오류 발생: {e}")
        # Groq json_validate_failed 시 failed_generation에서 JSON 복구
        try:
            import re
            err_str = str(e)
            # failed_generation 값 추출
            match = re.search(r"'failed_generation':\s*'((?:[^'\\]|\\.)*)'", err_str)
            if match:
                raw_json = match.group(1).encode('raw_unicode_escape').decode('unicode_escape')
                recovered = json.loads(raw_json)
                print("✅ failed_generation에서 JSON 복구 성공")
                return recovered
        except Exception as e2:
            print(f"⚠️ JSON 복구도 실패: {e2}")
=======
        print(f"⚠️ LLM 분석 준비 중 오류 발생 (패키지/설정 문제일 가능성): {type(e).__name__}: {e}")
>>>>>>> refs/remotes/origin/Heesun5
        return {}


def _get_mock_sentiment() -> SentimentResult:
    return SentimentResult(
        sentiment=Sentiment(positive=0.80, negative=0.20),
        explanation=[
            {
                "type": "positive",
                "title": "LG씨엔에스 주가, 7월 23일 장중 69,000원 6.8% 상승...",
                "chips": ["6.8% 상승", "수급 모멘텀"],
                "url": "#"
            },
            {
                "type": "negative",
                "title": "[특징주] LG씨엔에스, 차익실현 매물 출회에 장중 하락세...",
                "chips": ["차익실현 매물", "하락세"],
                "url": "#"
            }
        ],
        sentiment_warning=None,
        trend=None,
        top_keywords="최근 장중 상승 등 강력한 수급 모멘텀이 유지되고 있으나, 차익실현 매물 출회로 인한 단기 변동성이 공존하고 있습니다.",
        volatility=0.12,
    )