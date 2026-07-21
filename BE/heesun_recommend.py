"""
[담당: 희선]
관심종목 추천 — 하이브리드 방식 (컨텐츠 기반 + Item-Based CF)

콜드스타트 문제 해결 전략:
  - 서비스 초기(상호작용 데이터 적음): 컨텐츠 기반(가격 상관관계) 추천만 사용
  - 데이터가 쌓이면(임계값 이상): Item-Based CF 비중을 점진적으로 높여서 블렌딩
  - CF는 User-Based가 아닌 Item-Based를 사용 — 유저 수가 적은 초기 서비스에서
    "종목 간 동시 관심등록 패턴"이 "유저 간 취향 유사도"보다 더 안정적으로 계산됨

환경변수:
  USE_MOCK_DATA=false  실제 Firestore 상호작용 데이터 + yfinance 상관관계 사용
"""
import os
import pandas as pd
import numpy as np

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# CF로 전환하는 최소 상호작용 데이터 개수 (이 미만이면 컨텐츠 기반만 사용)
CF_MIN_INTERACTIONS = 100
# CF 비중이 최대로 커지는 상호작용 개수 (이 이상이면 CF 비중 상한 도달)
CF_MAX_WEIGHT_AT = 1000
CF_MAX_WEIGHT = 0.7  # 데이터가 아무리 많아도 컨텐츠 기반을 완전히 배제하지는 않음


# -----------------------------------------------------------------------------
# 1. 이벤트 로깅 — 관심등록/분석 클릭 등을 Firestore에 기록 (CF의 원재료)
# -----------------------------------------------------------------------------

def log_user_event(uid: str, ticker: str, event_type: str) -> None:
    """
    사용자 행동을 기록한다. main.py의 /api/events 엔드포인트에서 호출됨.
    event_type 예: "favorite_add", "favorite_remove", "analyze_click"
    """
    if USE_MOCK:
        print(f"[MOCK] 이벤트 기록 스킵: {uid} / {ticker} / {event_type}")
        return

    from firebase_admin import firestore
    from datetime import datetime

    db = firestore.client()
    db.collection("user_events").add({
        "uid": uid,
        "ticker": ticker,
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
    })


def _get_interaction_count() -> int:
    """전체 상호작용(관심등록) 이벤트 개수 — 콜드스타트 여부 판단 기준"""
    if USE_MOCK:
        return 0  # 목데이터 모드에서는 항상 콜드스타트로 간주

    from firebase_admin import firestore
    db = firestore.client()
    docs = db.collection("user_events").where("event_type", "==", "favorite_add").stream()
    return sum(1 for _ in docs)


def _get_favorites_matrix() -> pd.DataFrame | None:
    """
    Firestore에서 (유저 x 종목) 관심등록 매트릭스를 만든다.
    행=uid, 열=ticker, 값=1(관심등록됨)/0(안됨)
    데이터가 없으면 None 반환.
    """
    if USE_MOCK:
        return None

    from firebase_admin import firestore
    db = firestore.client()

    add_events = db.collection("user_events").where("event_type", "==", "favorite_add").stream()
    remove_events = db.collection("user_events").where("event_type", "==", "favorite_remove").stream()

    # 현재 관심등록 상태만 남기기 위해 add/remove를 시간순으로 병합
    records = []
    for doc in add_events:
        d = doc.to_dict()
        records.append((d["uid"], d["ticker"], d["timestamp"], 1))
    for doc in remove_events:
        d = doc.to_dict()
        records.append((d["uid"], d["ticker"], d["timestamp"], 0))

    if not records:
        return None

    df = pd.DataFrame(records, columns=["uid", "ticker", "timestamp", "value"])
    df = df.sort_values("timestamp")
    # 같은 (uid, ticker) 쌍은 가장 최근 상태만 유지
    latest = df.groupby(["uid", "ticker"]).last().reset_index()
    latest = latest[latest["value"] == 1]  # 현재 관심등록된 것만

    if latest.empty:
        return None

    matrix = latest.pivot_table(index="uid", columns="ticker", values="value", fill_value=0)
    return matrix


# -----------------------------------------------------------------------------
# 2. 컨텐츠 기반 추천 — 가격 상관관계 (데이터 없어도 항상 동작)
# -----------------------------------------------------------------------------

def _get_content_based_recommendations(
    ticker: str, candidate_tickers: list[str], period_days: int = 90
) -> list[dict]:
    """
    최근 N일 가격 움직임 상관계수를 기반으로 유사 종목을 추천한다.
    유저 데이터가 전혀 없어도 항상 동작하는 콜드스타트 대응 기본 로직.
    """
    import yfinance as yf

    try:
        base_hist = yf.Ticker(ticker).history(period=f"{period_days}d")["Close"]
        base_returns = base_hist.pct_change().dropna()
    except Exception:
        return []

    if base_returns.empty:
        return []

    scores = []
    for cand in candidate_tickers:
        if cand == ticker:
            continue
        try:
            cand_hist = yf.Ticker(cand).history(period=f"{period_days}d")["Close"]
            cand_returns = cand_hist.pct_change().dropna()

            aligned = pd.concat([base_returns, cand_returns], axis=1, join="inner").dropna()
            if len(aligned) < 20:  # 최소 20거래일 겹쳐야 신뢰할 만한 상관계수
                continue

            corr = aligned.iloc[:, 0].corr(aligned.iloc[:, 1])
            if pd.isna(corr):
                continue

            scores.append({"ticker": cand, "score": round(float(corr), 3), "source": "content"})
        except Exception:
            continue

    return sorted(scores, key=lambda x: -abs(x["score"]))


# -----------------------------------------------------------------------------
# 3. Item-Based 협업 필터링 — 데이터가 쌓인 뒤에만 동작
# -----------------------------------------------------------------------------

def _get_cf_recommendations(ticker: str, top_k: int = 10) -> list[dict]:
    """
    관심등록 매트릭스에서 종목 간 코사인 유사도를 계산해 추천한다.
    Item-Based를 쓰는 이유: 초기 서비스는 유저 수가 적어 User-Based 유사도가
    불안정하지만, 종목 수는 상대적으로 고정적이라 아이템 간 유사도가 더 안정적임.
    """
    matrix = _get_favorites_matrix()
    if matrix is None or ticker not in matrix.columns:
        return []

    from sklearn.metrics.pairwise import cosine_similarity

    item_matrix = matrix.T  # 종목 x 유저로 전치
    similarities = cosine_similarity(item_matrix)
    sim_df = pd.DataFrame(similarities, index=item_matrix.index, columns=item_matrix.index)

    if ticker not in sim_df.columns:
        return []

    scores = sim_df[ticker].drop(ticker, errors="ignore").sort_values(ascending=False)
    scores = scores[scores > 0]  # 유사도 0 이하는 의미 없는 추천이므로 제외

    return [
        {"ticker": t, "score": round(float(s), 3), "source": "cf"}
        for t, s in scores.head(top_k).items()
    ]


# -----------------------------------------------------------------------------
# 4. 하이브리드 블렌딩 — 데이터 양에 따라 CF 비중을 점진적으로 조절
# -----------------------------------------------------------------------------

def _calc_cf_weight(interaction_count: int) -> float:
    """상호작용 데이터가 많을수록 CF 비중을 높이되, CF_MAX_WEIGHT를 넘지 않음"""
    if interaction_count < CF_MIN_INTERACTIONS:
        return 0.0
    ratio = (interaction_count - CF_MIN_INTERACTIONS) / (CF_MAX_WEIGHT_AT - CF_MIN_INTERACTIONS)
    return round(min(max(ratio, 0.0), 1.0) * CF_MAX_WEIGHT, 2)


def _blend_recommendations(
    content_recs: list[dict], cf_recs: list[dict], cf_weight: float, top_k: int = 6
) -> list[dict]:
    """
    컨텐츠 기반과 CF 추천을 점수 정규화 후 가중합으로 병합한다.
    같은 종목이 양쪽에 다 나오면 두 점수를 합산해 상위 노출되도록 함.
    """
    def _normalize(recs: list[dict]) -> dict[str, float]:
        if not recs:
            return {}
        max_score = max(abs(r["score"]) for r in recs) or 1.0
        return {r["ticker"]: r["score"] / max_score for r in recs}

    content_norm = _normalize(content_recs)
    cf_norm = _normalize(cf_recs)

    all_tickers = set(content_norm) | set(cf_norm)
    blended = []
    for t in all_tickers:
        content_score = content_norm.get(t, 0.0) * (1 - cf_weight)
        cf_score = cf_norm.get(t, 0.0) * cf_weight
        final_score = content_score + cf_score
        blended.append({
            "ticker": t,
            "score": round(final_score, 3),
            "from_cf": t in cf_norm,
            "from_content": t in content_norm,
        })

    blended.sort(key=lambda x: -x["score"])
    return blended[:top_k]


# -----------------------------------------------------------------------------
# 5. 메인 함수 — 오케스트레이터(main.py)가 이 함수만 호출함
# -----------------------------------------------------------------------------

def get_hybrid_recommendations(
    ticker: str, candidate_tickers: list[str], top_k: int = 6
) -> dict:
    """
    하이브리드 관심종목 추천의 진입점.

    Args:
        ticker: 기준 종목
        candidate_tickers: 추천 후보 풀 (main.py의 섹터 폴백/야후 추천 결과 등 재사용)
        top_k: 최종 추천 개수

    Returns:
        {
            "results": [{"ticker": ..., "score": ..., "from_cf": bool, "from_content": bool}, ...],
            "cf_weight": float,          # 이번 응답에서 CF가 반영된 비중 (0이면 콜드스타트 상태)
            "interaction_count": int,    # 참고용 — 현재까지 쌓인 상호작용 수
        }
    """
    interaction_count = _get_interaction_count()
    cf_weight = _calc_cf_weight(interaction_count)

    content_recs = _get_content_based_recommendations(ticker, candidate_tickers)

    cf_recs = []
    if cf_weight > 0:
        cf_recs = _get_cf_recommendations(ticker)
        if not cf_recs:
            # CF 데이터가 이 종목에 한해 부족하면 컨텐츠 기반으로 자동 대체
            cf_weight = 0.0

    if not content_recs and not cf_recs:
        results = []
    else:
        results = _blend_recommendations(content_recs, cf_recs, cf_weight, top_k=top_k)

    return {
        "results": results,
        "cf_weight": cf_weight,
        "interaction_count": interaction_count,
    }


# -----------------------------------------------------------------------------
# 직접 실행 테스트 (python heesun_recommend.py 로 실행)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    TEST_TICKER = "005930.KS"
    TEST_CANDIDATES = ["000660.KS", "005380.KS", "035420.KS", "035720.KS", "051910.KS"]

    result = get_hybrid_recommendations(TEST_TICKER, TEST_CANDIDATES)

    print(f"기준 종목: {TEST_TICKER}")
    print(f"CF 비중: {result['cf_weight']} (상호작용 {result['interaction_count']}건)\n")
    for r in result["results"]:
        source = []
        if r["from_content"]:
            source.append("컨텐츠")
        if r["from_cf"]:
            source.append("CF")
        print(f"  {r['ticker']}: {r['score']} ({'+'.join(source)})")