# BE/seed_cases.py — 주요 종목만 골라서 케이스 쌓기
import requests
import time

API_BASE = "http://localhost:8000"

TICKERS = [
    "005930.KS",  # 삼성전자
    "000660.KS",  # SK하이닉스
    "003550.KS",  # LG
    "005380.KS",  # 현대차
    "000270.KS",  # 기아
    "035420.KS",  # NAVER
    "035720.KS",  # 카카오
]

for ticker in TICKERS:
    try:
        print(f"🔍 {ticker} 분석 중...")
        res = requests.get(f"{API_BASE}/api/analyze", params={"ticker": ticker}, timeout=60)
        if res.status_code == 200:
            print(f"✅ {ticker} 성공")
        else:
            print(f"⚠️ {ticker} 실패: {res.status_code} — {res.text[:100]}")
    except Exception as e:
        print(f"❌ {ticker} 에러: {e}")

    time.sleep(3)

print("🎉 전체 완료")