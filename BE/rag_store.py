# BE/rag_store.py — prediction_records/*.json을 그대로 케이스 저장소로 재사용
# 별도 벡터DB 없이 코사인 유사도로 직접 비교 (지금 규모엔 충분)
import json
from pathlib import Path
import numpy as np
from embedding import embed_text

RECORD_DIR = Path(__file__).parent / "prediction_records"


def search_similar_cases(situation_text: str, ticker: str = None, top_k: int = 3) -> list[dict]:
    """
    situation_text(현재 분석 상황 요약)와 비슷한 과거 케이스를 검색.
    critique(사후진단)가 없어도 llmReport(예측 당시 근거)만으로 검색 가능
    — 케이스 초기 단계라 critique 없는 케이스도 다 검색 대상에 포함.
    """
    query_vec = np.array(embed_text(situation_text))
    candidates = []

    for file in RECORD_DIR.glob("*.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue

        if ticker and data.get("ticker") != ticker:
            continue

        for r in data.get("records", []):
            llm_report = r.get("llmReport")
            if not llm_report:
                continue

            case_text = llm_report[:300]
            case_vec = np.array(embed_text(case_text))
            sim = float(
                np.dot(query_vec, case_vec)
                / (np.linalg.norm(query_vec) * np.linalg.norm(case_vec) + 1e-8)
            )

            # critique는 있으면 보너스로 포함(학습 교훈), 없으면 None
            first_pred = next(iter(r.get("predictions", {}).values()), {})

            candidates.append({
                "similarity": round(sim, 3),
                "ticker": data.get("ticker"),
                "name": data.get("name"),
                "date": r.get("date"),
                "reasoning_snippet": llm_report[:150],
                "critique": first_pred.get("critique"),
            })

    candidates.sort(key=lambda x: x["similarity"], reverse=True)
    return candidates[:top_k]