<<<<<<< HEAD
def _get_sentiment_score(text, pipe):
    """
    0~1 범위로 반환 (1=완전 긍정, 0=완전 부정).
    중립을 제외하고 긍정/(긍정+부정)으로 정규화.
    """
    result = pipe(text, truncation=True, max_length=512)[0]
    scores = {item["label"].lower(): item["score"] for item in result}
    pos = scores.get("positive", 0)
    neg = scores.get("negative", 0)
    total = pos + neg
    return (pos / total) if total > 0 else 0.5


def explain_sentiment(text, pipe, top_k=4):
    """
    단어별 기여도 계산 (Leave-one-out 방식).
    단어를 하나씩 빼봐서 감성 점수 변화로 기여도를 측정.
    """
    words = text.split()
    if len(words) < 2:
        return []

    base_score = _get_sentiment_score(text, pipe)
    contributions = []

    for i, word in enumerate(words):
        modified = " ".join(words[:i] + words[i+1:])
        if not modified.strip():
            continue
        mod_score = _get_sentiment_score(modified, pipe)
        contributions.append({
            "word": word,
            "contribution": round(base_score - mod_score, 3),
        })

    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contributions[:top_k]
=======
"""
[XAI 설명 레이어 — 담당: 연우]

FinBERT는 "긍정 0.7"이라고만 알려주고 "왜"는 설명 안 해줌.
이 모듈은 Leave-one-out 방식으로 "어떤 단어 때문에 그 점수가 나왔는지" 계산함.

원리:
1. 전체 문장으로 감성 점수 계산 (base_score)
2. 단어를 하나씩 빼고 다시 점수 계산
3. "뺐을 때 점수가 많이 바뀌면 = 그 단어가 중요했다"

진짜 SHAP보다 정확도는 낮지만, 설치 부담 없고 빠르게 동작해서 MVP에 적합.
"""


def _get_sentiment_score(text: str, finbert_pipe) -> float:
    """긍정 - 부정 = 종합 점수"""
    result = finbert_pipe(text, truncation=True, max_length=512)[0]
    scores = {item["label"].lower(): item["score"] for item in result}
    return scores.get("positive", 0) - scores.get("negative", 0)


def explain_sentiment(text: str, finbert_pipe, top_k: int = 4, max_words: int = 15) -> list[dict]:
    """
    단어별 기여도를 계산해서 영향력 순으로 반환.

    반환 예시:
    [
      {"word": "차세대 양산 계획", "contribution": 0.31},
      {"word": "중국 경쟁사 압박", "contribution": -0.21},
      ...
    ]

    max_words: 문장이 너무 길면 FinBERT 반복 호출(단어 수만큼)이 늘어나
    응답이 느려지므로, 앞부분 max_words개까지만 잘라서 계산한다.
    (제목 위주 텍스트라 앞부분에 핵심 정보가 오는 경우가 많아 큰 손실은 아님)
    """
    # 의미 단위로 나누기 (실제로는 형태소 분석기 추천, MVP는 간단히 어절 단위)
    words = text.split()[:max_words]
    if len(words) < 2:
        return []
    text = " ".join(words)

    base_score = _get_sentiment_score(text, finbert_pipe)

    contributions = []
    for i, word in enumerate(words):
        # 이 단어를 뺀 문장
        modified_text = " ".join(words[:i] + words[i + 1:])
        if not modified_text.strip():
            continue

        modified_score = _get_sentiment_score(modified_text, finbert_pipe)

        # 단어를 뺐을 때 점수가 떨어지면(base - modified > 0) → 그 단어가 긍정에 기여
        contribution = base_score - modified_score

        contributions.append({
            "word": word,
            "contribution": round(contribution, 3),
        })

    # 영향력(절댓값) 큰 순서로 정렬
    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contributions[:top_k]


# ── 사용 예시 ──
if __name__ == "__main__":
    from transformers import pipeline

    pipe = pipeline("text-classification", model="ProsusAI/finbert", top_k=None)
    text = "삼성전자 반도체 업황 회복 기대감 속에 차세대 양산 계획 발표. 다만 중국 경쟁사 압박 우려도 일부 제기됨"

    explanation = explain_sentiment(text, pipe)
    for item in explanation:
        sign = "+" if item["contribution"] > 0 else ""
        print(f"{item['word']}: {sign}{item['contribution']}")
>>>>>>> origin/FE_CHAEMIN
