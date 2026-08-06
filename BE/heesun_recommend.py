"""
[담당: 희선]
관심종목 추천 — 하이브리드 방식 (섹터 매칭 + 컨텐츠 기반 + Item-Based CF)

콜드스타트 문제 해결 전략:
  - 서비스 초기(상호작용 데이터 적음): 섹터 매칭 + 컨텐츠 기반(가격 상관관계)만 사용
  - 데이터가 쌓이면(임계값 이상): Item-Based CF 비중을 점진적으로 높여서 블렌딩
  - CF는 User-Based가 아닌 Item-Based를 사용 — 유저 수가 적은 초기 서비스에서
    "종목 간 동시 관심등록 패턴"이 "유저 간 취향 유사도"보다 더 안정적으로 계산됨

⚠️ 수정 (섹터/계열 매칭 추가):
   기존엔 get_expanded_candidate_pool이 sector_kr 파라미터를 받아놓고도
   전혀 사용하지 않아서 "같은 계열 종목"이라는 신호가 완전히 무시되고 있었음.
   → 세 번째 추천 소스로 "섹터 매칭"을 추가. 유저 데이터·가격 이력과 무관하게
     항상 안정적으로 작동하는 신호이므로, 콜드스타트 상태에서도 고정 비중(30%)으로
     항상 반영되도록 설계함.

후보군 확장:
  - KRX에서 받은 kospi200.csv / kosdaq150.csv를 유니버스로 사용해
    후보군을 6~12개 수준에서 최대 수백 개 수준으로 확장함.

환경변수:
  USE_MOCK_DATA=false  실제 Firestore 상호작용 데이터 + yfinance 상관관계/섹터 사용
"""
import os
import pandas as pd
import numpy as np
from pathlib import Path

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# CF로 전환하는 최소 상호작용 데이터 개수 (이 미만이면 컨텐츠+섹터만 사용)
CF_MIN_INTERACTIONS = 100
# CF 비중이 최대로 커지는 상호작용 개수 (이 이상이면 CF 비중 상한 도달)
CF_MAX_WEIGHT_AT = 1000
CF_MAX_WEIGHT = 0.7  # 데이터가 아무리 많아도 컨텐츠 기반을 완전히 배제하지는 않음

# 섹터(계열) 매칭에 항상 부여하는 고정 비중.
# 가격 상관관계나 CF 데이터가 부족해도 "같은 업종"이라는 신호는 항상 신뢰할 수 있으므로
# 콜드스타트 여부와 무관하게 고정값으로 반영한다.
SECTOR_FIXED_WEIGHT = 0.3

_DATA_DIR = Path(__file__).parent / "data"
_UNIVERSE_DF = None  # 최초 호출 시 1회 로드 후 캐시
_SECTOR_CACHE: dict[str, str] = {}  # ticker -> sector/industry 문자열 캐시 (프로세스 내 재사용)

# 파일명 -> yfinance 티커 접미사 매핑
_UNIVERSE_FILES = {
    "kospi200.csv": ".KS",
    "kosdaq150.csv": ".KQ",
}


def _load_universe() -> pd.DataFrame:
    """
    KRX에서 다운로드한 원본 CSV(kospi200.csv, kosdaq150.csv)를 읽어
    ticker/name 형태로 정규화한 종목 유니버스를 반환한다 (1회 캐시).

    원본 컬럼: 종목코드, 종목명, 종가, 대비, 등락률, 상장시가총액 (CP949 인코딩)
    필요한 건 종목코드/종목명뿐이라 나머지는 버림.
    """
    global _UNIVERSE_DF
    if _UNIVERSE_DF is not None:
        return _UNIVERSE_DF

    frames = []
    for fname, suffix in _UNIVERSE_FILES.items():
        fpath = _DATA_DIR / fname
        if not fpath.exists():
            continue
        try:
            raw = pd.read_csv(fpath, encoding="cp949", dtype={"종목코드": str})
        except Exception as e:
            print(f"⚠️ {fname} 로드 실패: {e}")
            continue

        if "종목코드" not in raw.columns or "종목명" not in raw.columns:
            print(f"⚠️ {fname}에 종목코드/종목명 컬럼이 없습니다. 컬럼: {list(raw.columns)}")
            continue

        df = raw[["종목코드", "종목명"]].copy()
        df.columns = ["code", "name"]
        df["code"] = df["code"].astype(str).str.zfill(6)
        # 6자리 순수 숫자 코드만 사용 (ETN/우선주 등 특수 코드는 yfinance 조회가 안 되므로 제외)
        df = df[df["code"].str.match(r"^\d{6}$")]
        df["ticker"] = df["code"] + suffix
        frames.append(df[["ticker", "name"]])

    if not frames:
        print("⚠️ kospi200.csv / kosdaq150.csv 를 찾을 수 없어 후보군 확장 없이 동작합니다.")
        _UNIVERSE_DF = pd.DataFrame(columns=["ticker", "name"])
    else:
        _UNIVERSE_DF = pd.concat(frames, ignore_index=True).drop_duplicates(subset="ticker")

    return _UNIVERSE_DF


def get_expanded_candidate_pool(
    ticker: str, sector_kr: str = "", max_candidates: int = 40, seed: int = 42
) -> list[str]:
    """
    CSV로 준비한 코스피200/코스닥150 전체 종목 중에서 후보군을 뽑는다.
    - 무작위로 섞어서 후보군 다양성도 확보
    - 실제 "같은 섹터 우선순위"는 get_hybrid_recommendations 안에서
      섹터 스코어링으로 반영됨 (후보군 자체는 넓게 유지해서 다양한 후보를 확보)
    - CSV가 없으면 빈 리스트를 반환해서 main.py가 기존 방식(야후+섹터폴백)으로
      자동 대체하도록 함 (안전한 폴백 유지)
    """
    df = _load_universe()
    if df.empty:
        return []

    pool = df[df["ticker"] != ticker]["ticker"].tolist()

    if len(pool) <= max_candidates:
        return pool

    import random
    rng = random.Random(seed)
    return rng.sample(pool, max_candidates)


# -----------------------------------------------------------------------------
# 0. 섹터(계열) 조회 — 컨텐츠/CF와 별개인 세 번째 추천 신호
# -----------------------------------------------------------------------------

def _get_sector_raw(ticker: str) -> str:
    """
    yfinance에서 종목의 sector(없으면 industry)를 조회한다. 결과는 프로세스
    내에서 캐시해서 같은 티커를 반복 조회하지 않도록 한다.
    실패 시 빈 문자열을 반환 — 이 경우 해당 종목은 섹터 매칭 대상에서 자연히 제외됨.
    """
    if ticker in _SECTOR_CACHE:
        return _SECTOR_CACHE[ticker]

    sector = ""
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        sector = info.get("sector") or info.get("industry") or ""
    except Exception:
        sector = ""

    _SECTOR_CACHE[ticker] = sector
    return sector


def _get_sector_based_recommendations(ticker: str, candidate_tickers: list[str]) -> list[dict]:
    """
    기준 종목과 섹터/업종이 같은 후보들에게 점수를 부여한다.
    가격 이력이나 유저 상호작용 데이터가 전혀 없어도 항상 동작하는,
    가장 안정적인 콜드스타트 대응 신호.
    """
    from concurrent.futures import ThreadPoolExecutor

    base_sector = _get_sector_raw(ticker)
    if not base_sector:
        return []

    with ThreadPoolExecutor(max_workers=8) as ex:
        cand_sectors = dict(zip(candidate_tickers, ex.map(_get_sector_raw, candidate_tickers)))

    scores = []
    for cand, sector in cand_sectors.items():
        if not sector:
            continue
        if sector == base_sector:
            # 완전 일치 → 만점. (세분화하고 싶으면 이후 유사도 스코어로 확장 가능)
            scores.append({"ticker": cand, "score": 1.0, "source": "sector"})

    return scores


# -----------------------------------------------------------------------------
# 1. 이벤트 로깅 — 관심등록/분석 클릭 등을 Firestore에 기록 (CF의 원재료)
# -----------------------------------------------------------------------------

def log_user_event(uid: str, ticker: str, event_type: str) -> None:
    """
    사용자 행동을 기록한다. main.py의 /api/events 엔드포인트에서 호출됨.
    event_type 예: "favorite_add", "favorite_remove", "related_click", "analyze_click"
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
    latest = df.groupby(["uid", "ticker"]).last().reset_index()
    latest = latest[latest["value"] == 1]

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
            if len(aligned) < 20:
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

    item_matrix = matrix.T
    similarities = cosine_similarity(item_matrix)
    sim_df = pd.DataFrame(similarities, index=item_matrix.index, columns=item_matrix.index)

    if ticker not in sim_df.columns:
        return []

    scores = sim_df[ticker].drop(ticker, errors="ignore").sort_values(ascending=False)
    scores = scores[scores > 0]

    return [
        {"ticker": t, "score": round(float(s), 3), "source": "cf"}
        for t, s in scores.head(top_k).items()
    ]


# -----------------------------------------------------------------------------
# 4. 하이브리드 블렌딩 — 섹터(고정) + 컨텐츠/CF(콜드스타트에 따라 조절)
# -----------------------------------------------------------------------------

def _calc_cf_weight(interaction_count: int) -> float:
    """상호작용 데이터가 많을수록 CF 비중을 높이되, CF_MAX_WEIGHT를 넘지 않음"""
    if interaction_count < CF_MIN_INTERACTIONS:
        return 0.0
    ratio = (interaction_count - CF_MIN_INTERACTIONS) / (CF_MAX_WEIGHT_AT - CF_MIN_INTERACTIONS)
    return round(min(max(ratio, 0.0), 1.0) * CF_MAX_WEIGHT, 2)


def _normalize(recs: list[dict]) -> dict[str, float]:
    if not recs:
        return {}
    max_score = max(abs(r["score"]) for r in recs) or 1.0
    return {r["ticker"]: r["score"] / max_score for r in recs}


def _blend_recommendations(
    content_recs: list[dict],
    cf_recs: list[dict],
    sector_recs: list[dict],
    cf_weight: float,
    top_k: int = 6,
) -> list[dict]:
    """
    섹터 매칭(고정 30%) + 컨텐츠/CF(나머지 70%, cf_weight 비율로 배분)를
    점수 정규화 후 가중합으로 병합한다.

    - SECTOR_FIXED_WEIGHT(0.3)는 유저 데이터·가격 이력과 무관하게 항상 반영되는
      "같은 계열" 신호. 콜드스타트 상태에서도 꺼지지 않음.
    - 나머지 0.7을 기존처럼 cf_weight 비율로 컨텐츠/CF에 배분.
    """
    content_norm = _normalize(content_recs)
    cf_norm = _normalize(cf_recs)
    sector_norm = _normalize(sector_recs)  # 섹터는 이미 0/1이라 사실상 그대로 유지됨

    remaining_weight = 1 - SECTOR_FIXED_WEIGHT  # 0.7
    content_weight = remaining_weight * (1 - cf_weight)
    cf_actual_weight = remaining_weight * cf_weight

    all_tickers = set(content_norm) | set(cf_norm) | set(sector_norm)
    blended = []
    for t in all_tickers:
        score = (
            content_norm.get(t, 0.0) * content_weight
            + cf_norm.get(t, 0.0) * cf_actual_weight
            + sector_norm.get(t, 0.0) * SECTOR_FIXED_WEIGHT
        )
        blended.append({
            "ticker": t,
            "score": round(score, 3),
            "from_cf": t in cf_norm,
            "from_content": t in content_norm,
            "from_sector": t in sector_norm,
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
    섹터 매칭 + 컨텐츠 기반(가격 상관관계) + Item-Based CF를 함께 사용한다.

    Returns:
        {
            "results": [{"ticker": ..., "score": ..., "from_cf": bool,
                          "from_content": bool, "from_sector": bool}, ...],
            "cf_weight": float,
            "interaction_count": int,
        }
    """
    interaction_count = _get_interaction_count()
    cf_weight = _calc_cf_weight(interaction_count)

    content_recs = _get_content_based_recommendations(ticker, candidate_tickers)
    sector_recs = _get_sector_based_recommendations(ticker, candidate_tickers)

    cf_recs = []
    if cf_weight > 0:
        cf_recs = _get_cf_recommendations(ticker)
        if not cf_recs:
            cf_weight = 0.0

    if not content_recs and not cf_recs and not sector_recs:
        results = []
    else:
        results = _blend_recommendations(content_recs, cf_recs, sector_recs, cf_weight, top_k=top_k)

    return {
        "results": results,
        "cf_weight": cf_weight,
        "interaction_count": interaction_count,
    }


# -----------------------------------------------------------------------------
# 직접 실행 테스트 (python heesun_recommend.py 로 실행)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    universe = _load_universe()
    print(f"유니버스 로드 완료: {len(universe)}개 종목\n")

    TEST_TICKER = "005930.KS"
    TEST_CANDIDATES = get_expanded_candidate_pool(TEST_TICKER)

    result = get_hybrid_recommendations(TEST_TICKER, TEST_CANDIDATES)

    print(f"기준 종목: {TEST_TICKER}")
    print(f"후보군 크기: {len(TEST_CANDIDATES)}")
    print(f"CF 비중: {result['cf_weight']} (상호작용 {result['interaction_count']}건)\n")
    for r in result["results"]:
        source = []
        if r["from_sector"]:
            source.append("섹터")
        if r["from_content"]:
            source.append("컨텐츠")
        if r["from_cf"]:
            source.append("CF")
        print(f"  {r['ticker']}: {r['score']} ({'+'.join(source)})")