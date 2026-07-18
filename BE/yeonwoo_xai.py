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
    """
    0~1 범위로 반환 (1=완전 긍정, 0=완전 부정).
    중립을 제외하고 긍정/(긍정+부정)으로 정규화.
    """
    result = finbert_pipe(text, truncation=True, max_length=512)[0]
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


# ── 사용 예시 ──
if __name__ == "__main__":
    from transformers import pipeline

    pipe = pipeline("text-classification", model="ProsusAI/finbert", top_k=None)
    text = "삼성전자 반도체 업황 회복 기대감 속에 차세대 양산 계획 발표. 다만 중국 경쟁사 압박 우려도 일부 제기됨"

    explanation = explain_sentiment(text, pipe)
    for item in explanation:
        sign = "+" if item["contribution"] > 0 else ""
        print(f"{item['word']}: {sign}{item['contribution']}")