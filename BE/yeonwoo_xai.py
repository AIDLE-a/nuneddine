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
