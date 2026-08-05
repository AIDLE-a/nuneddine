# BE/batch_collect.py — 장 마감 후 배치: target_date 도달 예측 결과 수집 + critic 진단
from datetime import datetime
from prediction_record import get_pending_outcomes, update_record_with_outcome
from yubin_data import get_price_on_date
from critic import diagnose_outcome


def run_batch_collect(today: str | None = None) -> dict:
    today = today or datetime.now().strftime("%Y-%m-%d")
    pending = get_pending_outcomes(today)

    summary = {"total": len(pending), "success": 0, "failed": 0, "skipped": 0}

    if not pending:
        print("✅ 수집할 대기 항목 없음")
        return summary

    print(f"🔍 대기 중인 예측 {len(pending)}건 발견")

    for item in pending:
        ticker = item["ticker"]
        run_date = item["run_date"]
        horizon = item["horizon"]
        target_date = item["targetDate"]
        predicted_price = item["predictedPrice"]
        name = item.get("name", ticker)

        try:
            actual_price = get_price_on_date(ticker, target_date)
            if actual_price is None:
                print(f"⏭️  {ticker} {target_date}: 실제값 아직 없음 — 건너뜀")
                summary["skipped"] += 1
                continue

            diagnosis = diagnose_outcome(
                ticker_name=name,
                predicted_price=predicted_price,
                actual_price=actual_price,
                llm_report=item.get("llmReport"),
            )

            ok = update_record_with_outcome(
                ticker=ticker,
                run_date=run_date,
                horizon=horizon,
                actual_value=actual_price,
                critique=diagnosis.get("critique"),
                failure_type=diagnosis.get("failure_type"),
            )

            if ok:
                summary["success"] += 1
                print(f"✅ {ticker} {run_date}({horizon}) → 실제:{actual_price} / 예측:{predicted_price}")
            else:
                summary["failed"] += 1

        except Exception as e:
            print(f"❌ {ticker} {run_date}({horizon}) 처리 중 오류: {e}")
            summary["failed"] += 1

    print(f"📊 배치 완료 — 성공:{summary['success']} 실패:{summary['failed']} 스킵:{summary['skipped']}")
    return summary


if __name__ == "__main__":
    run_batch_collect()