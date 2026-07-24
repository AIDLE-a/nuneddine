"""
[담당: 희선]
연관 종목 추천 시스템 오프라인 평가 지표.

MovieLens 프로젝트에서 썼던 평가 프레임(정확성/랭킹/다양성/신선도/속도)을
연관 종목 추천에 맞게 적용함.

지표 설명:
  - Coverage(커버리지): 전체 후보 종목 중 실제로 한 번이라도 추천되는 비율.
    낮으면 몇몇 인기 종목만 계속 추천된다는 뜻(추천 다양성 부족).
  - Diversity(다양성): 한 번의 추천 결과(top-6) 안에 섹터가 얼마나 다양하게 섞였는가.
  - Novelty(참신성): 추천된 종목이 얼마나 "덜 알려진" 종목인가.
    시가총액/거래량이 큰 유명 종목만 계속 추천되면 참신성이 낮음.
  - Accuracy proxy(정확성 근사치): 실제 유저 관심등록 라벨이 아직 부족하므로,
    "추천된 종목의 향후 N일 가격이 기준 종목과 실제로 유사하게 움직였는가"를
    사후검증(post-hoc validation)하는 방식으로 근사함.
  - Speed(속도): 추천 1건 생성에 걸리는 시간.

USE_MOCK_DATA=false 환경에서 실제 API를 호출하므로 평가 실행 시간이 다소 걸림.
"""
import os
import time
import numpy as np
import pandas as pd

import heesun_recommend

USE_MOCK = os.getenv("USE_MOCK_DATA", "true").lower() == "true"


# -----------------------------------------------------------------------------
# 1. Coverage — 추천 다양성이 후보군 전체를 얼마나 활용하는가
# -----------------------------------------------------------------------------

def evaluate_coverage(test_tickers: list[str], candidate_pool: list[str]) -> dict:
    """
    여러 기준 종목에 대해 추천을 돌려보고, 전체 후보군 중 실제로
    한 번이라도 추천된 종목의 비율(coverage)을 계산한다.
    """
    recommended_union = set()

    for ticker in test_tickers:
        result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        for r in result["results"]:
            recommended_union.add(r["ticker"])

    coverage = len(recommended_union) / len(candidate_pool) if candidate_pool else 0.0
    return {
        "coverage": round(coverage, 4),
        "unique_recommended_count": len(recommended_union),
        "candidate_pool_size": len(candidate_pool),
    }


# -----------------------------------------------------------------------------
# 2. Diversity — 한 번의 추천 결과 안에서 섹터가 얼마나 다양한가
# -----------------------------------------------------------------------------

def evaluate_diversity(ticker: str, candidate_pool: list[str], sector_map: dict[str, str]) -> dict:
    """
    sector_map: {ticker: sector_kr} — main.py에서 이미 계산 중인 섹터 정보를 재사용
    """
    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result["results"]

    if not recs:
        return {"diversity": 0.0, "unique_sectors": 0, "total_recs": 0}

    sectors = [sector_map.get(r["ticker"], "기타") for r in recs]
    unique_sectors = len(set(sectors))
    diversity = unique_sectors / len(recs)

    return {
        "diversity": round(diversity, 4),
        "unique_sectors": unique_sectors,
        "total_recs": len(recs),
    }


# -----------------------------------------------------------------------------
# 3. Novelty — 추천이 이미 유명한 종목 위주인지, 덜 알려진 종목도 포함하는지
# -----------------------------------------------------------------------------

def evaluate_novelty(ticker: str, candidate_pool: list[str]) -> dict:
    """
    거래량(volume)을 인기도 proxy로 사용.
    거래량이 적은(=덜 주목받는) 종목이 추천에 포함될수록 참신성이 높다고 봄.
    """
    import yfinance as yf

    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result["results"]
    if not recs:
        return {"novelty_score": 0.0}

    # 후보군 전체의 거래량 분포를 구해서, 추천된 종목들의 거래량 순위(백분위)를 계산
    volumes = {}
    for t in candidate_pool[:60]:  # 속도를 위해 상한
        try:
            hist = yf.Ticker(t).history(period="5d")
            if not hist.empty:
                volumes[t] = float(hist["Volume"].mean())
        except Exception:
            continue

    if not volumes:
        return {"novelty_score": None, "note": "거래량 데이터를 가져오지 못했습니다"}

    vol_series = pd.Series(volumes)
    percentiles = vol_series.rank(pct=True)  # 1.0에 가까울수록 거래량 많은(=유명한) 종목

    rec_percentiles = [percentiles.get(r["ticker"]) for r in recs if r["ticker"] in percentiles.index]
    rec_percentiles = [p for p in rec_percentiles if p is not None]

    if not rec_percentiles:
        return {"novelty_score": None, "note": "추천 종목의 거래량 정보 없음"}

    # 백분위 평균이 낮을수록(=유명하지 않을수록) 참신성이 높다고 정의 → 1에서 뺌
    novelty_score = 1 - float(np.mean(rec_percentiles))
    return {"novelty_score": round(novelty_score, 4)}


# -----------------------------------------------------------------------------
# 4. Accuracy proxy — 추천된 종목이 실제로 기준 종목과 유사하게 움직였는가 (사후검증)
# -----------------------------------------------------------------------------

def evaluate_accuracy_proxy(ticker: str, candidate_pool: list[str], validation_days: int = 14) -> dict:
    """
    라벨(정답) 데이터가 없는 콜드스타트 상황이므로, 완벽한 정확도 측정은 불가능함.
    대신 "추천 시점 이후 N일간 실제 가격 움직임이 기준 종목과 얼마나 상관됐는가"를
    사후적으로 검증해서 정확성의 근사치로 사용한다.

    주의: 이건 컨텐츠 기반(가격상관관계) 추천 자체를 재검증하는 성격이 강해서
    완전히 독립적인 정확도 지표는 아님 — 발표 시 이 한계를 명시하는 게 좋음.
    """
    import yfinance as yf

    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result["results"]
    if not recs:
        return {"accuracy_proxy": None}

    try:
        base_hist = yf.Ticker(ticker).history(period=f"{validation_days + 5}d")["Close"]
        base_returns = base_hist.pct_change().dropna().tail(validation_days)
    except Exception:
        return {"accuracy_proxy": None, "note": "기준 종목 데이터 조회 실패"}

    correlations = []
    for r in recs:
        try:
            cand_hist = yf.Ticker(r["ticker"]).history(period=f"{validation_days + 5}d")["Close"]
            cand_returns = cand_hist.pct_change().dropna().tail(validation_days)
            aligned = pd.concat([base_returns, cand_returns], axis=1, join="inner").dropna()
            if len(aligned) < 5:
                continue
            corr = aligned.iloc[:, 0].corr(aligned.iloc[:, 1])
            if not pd.isna(corr):
                correlations.append(corr)
        except Exception:
            continue

    if not correlations:
        return {"accuracy_proxy": None}

    return {
        "accuracy_proxy": round(float(np.mean(correlations)), 4),
        "validated_count": len(correlations),
    }


# -----------------------------------------------------------------------------
# 5. Speed — 추천 1건 생성 소요 시간
# -----------------------------------------------------------------------------

def evaluate_speed(ticker: str, candidate_pool: list[str], n_runs: int = 3) -> dict:
    times = []
    for _ in range(n_runs):
        start = time.time()
        heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        times.append(time.time() - start)

    return {
        "avg_seconds": round(float(np.mean(times)), 3),
        "max_seconds": round(float(np.max(times)), 3),
    }


# -----------------------------------------------------------------------------
# 6. 종합 리포트
# -----------------------------------------------------------------------------
def run_full_evaluation(test_tickers: list[str], sector_map: dict[str, str] | None = None) -> dict:
    """
    여러 지표를 한 번에 돌려서 종합 리포트를 만든다.
    발표 자료용 숫자를 한 번에 뽑을 때 이 함수 하나만 호출하면 됨.

    ⚠️ 후보군은 전체 유니버스(348개)가 아니라 실제 서비스와 동일하게
    get_expanded_candidate_pool()로 40개만 사용 — 전체를 쓰면 평가가
    비정상적으로 느려지고, 실제 /api/related가 쓰는 후보군과도 달라져
    평가 결과의 의미가 없어짐.
    """
    universe = heesun_recommend._load_universe()
    if universe.empty:
        return {"error": "kospi200.csv / kosdaq150.csv 가 없어 평가를 진행할 수 없습니다."}

    report = {
        "test_tickers": test_tickers,
        "per_ticker": {},
    }

    sector_map = sector_map or {}
    coverage_union = set()
    coverage_pool_union = set()

    for ticker in test_tickers:
        # 종목마다 실제 서비스와 동일한 방식으로 40개 후보군만 사용
        candidate_pool = heesun_recommend.get_expanded_candidate_pool(ticker, sector_map.get(ticker, ""))
        coverage_pool_union.update(candidate_pool)

        result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        for r in result["results"]:
            coverage_union.add(r["ticker"])

        report["per_ticker"][ticker] = {
            "candidate_pool_size": len(candidate_pool),
            "diversity": evaluate_diversity(ticker, candidate_pool, sector_map),
            "novelty": evaluate_novelty(ticker, candidate_pool),
            "accuracy_proxy": evaluate_accuracy_proxy(ticker, candidate_pool),
            "speed": evaluate_speed(ticker, candidate_pool),
        }

    coverage = len(coverage_union) / len(coverage_pool_union) if coverage_pool_union else 0.0
    report["coverage"] = {
        "coverage": round(coverage, 4),
        "unique_recommended_count": len(coverage_union),
        "candidate_pool_size_union": len(coverage_pool_union),
    }

    return report


if __name__ == "__main__":
    TEST_TICKERS = ["005930.KS", "000660.KS", "035420.KS"]

    result = run_full_evaluation(TEST_TICKERS)

    print("=" * 60)
    print("추천시스템 종합 평가 리포트")
    print("=" * 60)
    print(f"후보군 크기: {result.get('candidate_pool_size')}")
    print(f"\n[Coverage] {result.get('coverage')}")

    for ticker, metrics in result.get("per_ticker", {}).items():
        print(f"\n── {ticker} ──")
        print(f"  Diversity: {metrics['diversity']}")
        print(f"  Novelty: {metrics['novelty']}")
        print(f"  Accuracy proxy: {metrics['accuracy_proxy']}")
        print(f"  Speed: {metrics['speed']}")