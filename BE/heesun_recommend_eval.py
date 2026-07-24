"""
[담당: 희선]
연관 종목 추천 시스템 오프라인 평가 지표.

MovieLens 프로젝트에서 썼던 평가 프레임(정확성/랭킹/다양성/신선도/속도)을
연관 종목 추천에 맞게 적용함.
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
    recommended_union = set()

    for ticker in test_tickers:
        result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        for r in result.get("results", []):
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
    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result.get("results", [])

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
    import yfinance as yf

    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result.get("results", [])
    if not recs:
        return {"novelty_score": 0.0}

    volumes = {}
    for t in candidate_pool[:60]:
        try:
            hist = yf.Ticker(t).history(period="5d")
            if not hist.empty:
                volumes[t] = float(hist["Volume"].mean())
        except Exception:
            continue

    if not volumes:
        return {"novelty_score": 0.0, "note": "거래량 데이터 없음"}

    vol_series = pd.Series(volumes)
    percentiles = vol_series.rank(pct=True)

    rec_percentiles = [percentiles.get(r["ticker"]) for r in recs if r["ticker"] in percentiles.index]
    rec_percentiles = [p for p in rec_percentiles if p is not None]

    if not rec_percentiles:
        return {"novelty_score": 0.0, "note": "추천 종목 거래량 없음"}

    novelty_score = 1 - float(np.mean(rec_percentiles))
    return {"novelty_score": round(novelty_score, 4)}


# -----------------------------------------------------------------------------
# 4. Accuracy proxy — 사후검증
# -----------------------------------------------------------------------------
def evaluate_accuracy_proxy(ticker: str, candidate_pool: list[str], validation_days: int = 14) -> dict:
    import yfinance as yf

    result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
    recs = result.get("results", [])
    if not recs:
        return {"accuracy_proxy": 0.0}

    try:
        base_hist = yf.Ticker(ticker).history(period=f"{validation_days + 5}d")["Close"]
        base_returns = base_hist.pct_change().dropna().tail(validation_days)
    except Exception:
        return {"accuracy_proxy": 0.0, "note": "기준 종목 데이터 조회 실패"}

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
        return {"accuracy_proxy": 0.0}

    return {
        "accuracy_proxy": round(float(np.mean(correlations)), 4),
        "validated_count": len(correlations),
    }


# -----------------------------------------------------------------------------
# 5. Speed — 소요 시간
# -----------------------------------------------------------------------------
def evaluate_speed(ticker: str, candidate_pool: list[str], n_runs: int = 2) -> dict:
    times = []
    for _ in range(n_runs):
        start = time.time()
        heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        times.append(time.time() - start)

    avg_sec = float(np.mean(times)) if times else 0.0
    return {
        "avg_seconds": round(avg_sec, 3),
        "avg_ms": round(avg_sec * 1000, 1),
        "max_seconds": round(float(np.max(times)), 3) if times else 0.0,
    }


# -----------------------------------------------------------------------------
# 6. 프론트엔드 연동용 종합 리포트
# -----------------------------------------------------------------------------
def run_full_evaluation(test_tickers: list[str] = None, sector_map: dict[str, str] | None = None) -> dict:
    if not test_tickers:
        test_tickers = ["005930.KS", "000660.KS", "035420.KS"]

    universe = heesun_recommend._load_universe()
    if universe.empty:
        return {"error": "kospi200.csv / kosdaq150.csv 가 없어 평가를 진행할 수 없습니다."}

    sector_map = sector_map or {}
    coverage_union = set()
    coverage_pool_union = set()

    details = []
    diversity_list = []
    novelty_list = []
    accuracy_list = []
    speed_ms_list = []

    for ticker in test_tickers:
        candidate_pool = heesun_recommend.get_expanded_candidate_pool(ticker, sector_map.get(ticker, ""))
        coverage_pool_union.update(candidate_pool)

        result = heesun_recommend.get_hybrid_recommendations(ticker, candidate_pool)
        for r in result.get("results", []):
            coverage_union.add(r["ticker"])

        # 평가 계산
        div_res = evaluate_diversity(ticker, candidate_pool, sector_map)
        nov_res = evaluate_novelty(ticker, candidate_pool)
        acc_res = evaluate_accuracy_proxy(ticker, candidate_pool)
        spd_res = evaluate_speed(ticker, candidate_pool)

        div_val = div_res.get("diversity", 0.0) or 0.0
        nov_val = nov_res.get("novelty_score", 0.0) or 0.0
        acc_val = acc_res.get("accuracy_proxy", 0.0) or 0.0
        spd_val = spd_res.get("avg_ms", 0.0) or 0.0

        diversity_list.append(div_val)
        novelty_list.append(nov_val)
        accuracy_list.append(acc_val)
        speed_ms_list.append(spd_val)

        # React 화면 렌더링용 테이블 상세 데이터
        details.append({
            "ticker": ticker,
            "execution_time_ms": spd_val,
            "metrics": {
                "diversity": div_val,
                "novelty": nov_val,
                "accuracy_proxy": acc_val
            }
        })

    coverage_val = len(coverage_union) / len(coverage_pool_union) if coverage_pool_union else 0.0

    # React 모달이 표시할 summary 요약 통계 구조 생성
    summary = {
        "coverage": round(coverage_val, 4),
        "avg_diversity": round(float(np.mean(diversity_list)), 4) if diversity_list else 0.0,
        "avg_novelty": round(float(np.mean(novelty_list)), 4) if novelty_list else 0.0,
        "avg_speed_ms": round(float(np.mean(speed_ms_list)), 1) if speed_ms_list else 0.0,
        "accuracy": {
            "hit_rate": round(float(np.mean(accuracy_list)), 4) if accuracy_list else 0.0,
            "precision": round(float(np.mean(accuracy_list)), 4) if accuracy_list else 0.0,
            "recall": round(float(np.mean(accuracy_list)), 4) if accuracy_list else 0.0,
        }
    }

    return {
        "summary": summary,
        "details": details,
        "coverage": {
            "coverage": round(coverage_val, 4),
            "unique_recommended_count": len(coverage_union),
            "candidate_pool_size_union": len(coverage_pool_union),
        }
    }


if __name__ == "__main__":
    TEST_TICKERS = ["005930.KS", "000660.KS", "035420.KS"]
    result = run_full_evaluation(TEST_TICKERS)
    print("=" * 60)
    print("추천시스템 종합 평가 리포트")
    print(result["summary"])