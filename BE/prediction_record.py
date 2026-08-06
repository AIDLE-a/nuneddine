# BE/prediction_record.py — 예측 기록 저장/불러오기 (모델 학습용 데이터)
import json
from datetime import datetime
from pathlib import Path

RECORD_DIR = Path(__file__).parent / "prediction_records"
RECORD_DIR.mkdir(exist_ok=True)


def save_prediction_record(ticker: str, stock_name: str, base_record: dict, predictions: dict) -> bool:
    """
    예측 기록 저장
    - base_record: currentPrice, compositeAlpha, sentiment, newsCount, llmReport 등 공통 정보
    - predictions: {"d1": {...}, "d2": {...}, ...} — horizon별 예측치
    - ticker별 JSON 파일로 저장
    """
    try:
        file_path = RECORD_DIR / f"{ticker.replace('.', '_')}.json"

        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {"ticker": ticker, "name": stock_name, "records": []}

        record = {**base_record, "predictions": predictions}

        # 같은 date(예측 실행일) 중복 제거
        data["records"] = [r for r in data["records"] if r.get("date") != record.get("date")]

        record["savedAt"] = datetime.now().isoformat()
        data["records"].insert(0, record)
        data["records"] = data["records"][:365]  # 최대 1년치
        data["name"] = stock_name
        data["last_updated"] = datetime.now().isoformat()

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return True
    except Exception as e:
        print(f"⚠️ 예측 기록 저장 실패: {e}")
        return False


def update_record_with_outcome(
    ticker: str,
    run_date: str,
    horizon: str,          # "d1" / "d2" / "d3" ...
    actual_value: float,
    critique: str | None = None,
    failure_type: str | None = None,
) -> bool:
    """
    target_date 도달 후 배치가 호출
    - run_date(예측 실행일) + horizon으로 특정 예측 하나를 찾아 결과 채워 넣기
    """
    try:
        file_path = RECORD_DIR / f"{ticker.replace('.', '_')}.json"
        if not file_path.exists():
            print(f"⚠️ 레코드 없음: {ticker}")
            return False

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        found = False
        for r in data["records"]:
            if r.get("date") != run_date:
                continue
            pred = r.get("predictions", {}).get(horizon)
            if not pred:
                continue

            predicted = pred.get("predictedPrice")
            pred["actualValue"] = actual_value
            if predicted is not None:
                error = actual_value - predicted
                pred["error"] = error
                pred["errorPct"] = round(error / predicted * 100, 2)
            if critique is not None:
                pred["critique"] = critique
            if failure_type is not None:
                pred["failureType"] = failure_type
            pred["outcomeUpdatedAt"] = datetime.now().isoformat()
            found = True
            break

        if not found:
            print(f"⚠️ run_date={run_date}, horizon={horizon} 못 찾음: {ticker}")
            return False

        data["last_updated"] = datetime.now().isoformat()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return True
    except Exception as e:
        print(f"⚠️ 결과 업데이트 실패: {e}")
        return False


def get_pending_outcomes(today: str | None = None) -> list[dict]:
    """
    batch_collect.py가 매일 호출
    - 각 record의 predictions 중 targetDate <= today 이면서 actualValue 없는 것만 반환
    """
    today = today or datetime.now().strftime("%Y-%m-%d")
    pending = []

    for file in RECORD_DIR.glob("*.json"):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            continue

        ticker = data.get("ticker")
        for r in data.get("records", []):
            for horizon, pred in r.get("predictions", {}).items():
                if "actualValue" in pred:
                    continue
                target_date = pred.get("targetDate")
                if not target_date or target_date > today:
                    continue
                pending.append({
                    "ticker": ticker,
                    "name": data.get("name"),
                    "run_date": r.get("date"),
                    "horizon": horizon,
                    "targetDate": target_date,
                    "predictedPrice": pred.get("predictedPrice"),
                    "llmReport": r.get("llmReport"),
                })

    return pending


def load_prediction_records(ticker: str) -> dict:
    """예측 기록 불러오기"""
    try:
        file_path = RECORD_DIR / f"{ticker.replace('.', '_')}.json"
        if not file_path.exists():
            return {"ticker": ticker, "records": []}
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return {"ticker": ticker, "records": [], "error": str(e)}


def load_all_records() -> list:
    """전체 종목 예측 기록 목록"""
    result = []
    for file in RECORD_DIR.glob("*.json"):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                result.append({
                    "ticker": data.get("ticker"),
                    "name": data.get("name"),
                    "record_count": len(data.get("records", [])),
                    "last_updated": data.get("last_updated"),
                })
        except Exception:
            pass
    return sorted(result, key=lambda x: x.get("last_updated", ""), reverse=True)