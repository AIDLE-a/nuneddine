# BE/prediction_record.py — 예측 기록 저장/불러오기 (모델 학습용 데이터)
import json
import os
from datetime import datetime
from pathlib import Path

RECORD_DIR = Path(__file__).parent / "prediction_records"
RECORD_DIR.mkdir(exist_ok=True)

def save_prediction_record(ticker: str, stock_name: str, record: dict) -> bool:
    """
    예측 기록 저장
    - ticker별 JSON 파일로 저장
    - 모델 학습 데이터로 활용 가능한 구조
    """
    try:
        file_path = RECORD_DIR / f"{ticker.replace('.', '_')}.json"
        
        # 기존 기록 불러오기
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {
                "ticker": ticker,
                "name": stock_name,
                "records": []
            }

        # 같은 날짜 중복 제거
        data["records"] = [r for r in data["records"] if r.get("date") != record.get("date")]
        
        # 새 기록 추가
        record["saved_at"] = datetime.now().isoformat()
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
        except:
            pass
    return sorted(result, key=lambda x: x.get("last_updated", ""), reverse=True)