"""
NuneDDine 다마고치 BLE 송신기
5분마다 관심 종목 주가를 ESP32로 전송

실행: python ble_sender.py
필요: pip install bleak requests
"""

import asyncio
import requests
from bleak import BleakClient, BleakScanner

_name_cache: dict = {}

def get_english_name(ticker: str) -> str:
    """yfinance로 영문 종목명 조회 (9자 이내, 캐시 사용)"""
    if ticker in _name_cache:
        return _name_cache[ticker]
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        name = info.get("shortName") or info.get("longName") or ticker
        # 불필요한 단어 제거해서 짧게
        for drop in [" Co.,", " Corp.", " Inc.", " Ltd.", " Co.,Ltd.", "Corporation", "Company"]:
            name = name.replace(drop, "")
        name = name.strip()[:9]
    except Exception:
        name = ticker[:9]
    _name_cache[ticker] = name
    return name

DEVICE_NAME = "NuneDDine"
CHAR_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
API_BASE    = "http://localhost:8000"
INTERVAL    = 5 * 60  # 5분

def get_uid():
    """백엔드에서 현재 로그인된 UID 가져오기"""
    try:
        r = requests.get(f"{API_BASE}/api/active-user", timeout=5)
        return r.json().get("uid", "")
    except Exception as e:
        print(f"UID 조회 실패: {e}")
        return ""


def get_watchlist():
    """백엔드에서 사용자 관심 종목 가져오기 (최대 5개, 매수가/수량 포함)"""
    uid = get_uid()
    if not uid:
        print("앱에 로그인된 사용자가 없어요.")
        return []
    try:
        r = requests.get(f"{API_BASE}/api/watchlist", params={"uid": uid}, timeout=8)
        favorites = r.json().get("favorites", [])
        result = []
        for f in favorites[:6]:
            ticker = f["ticker"]
            name = get_english_name(ticker)
            buy_price = f.get("purchasePrice") or 0.0
            buy_qty   = f.get("purchaseQuantity") or 0
            result.append((ticker, name, float(buy_price), int(buy_qty)))
        return result
    except Exception as e:
        print(f"관심 종목 조회 실패: {e}")
        return []


def get_currency(ticker: str) -> str:
    """KRX 종목이면 W(원화), 그 외는 $(달러)"""
    return "W" if (".KS" in ticker or ".KQ" in ticker or ".KX" in ticker) else "$"


def fetch_all():
    """모든 관심 종목 주가 가져오기 (매수가 기준 손익 포함)"""
    watchlist = get_watchlist()
    if not watchlist:
        print("관심 종목이 없어요. USER_UID를 확인하세요.")
        return ""
    entries = []
    for ticker, name, buy_price, buy_qty in watchlist:
        try:
            r = requests.get(
                f"{API_BASE}/api/tamagotchi",
                params={"ticker": ticker},
                timeout=8
            )
            data = r.json()
            pct   = data.get("change_pct", 0.0)
            price = data.get("price", 0.0)
            unit  = get_currency(ticker)
            if price:
                # 포맷: Name,pct,price,unit,buyPrice,buyQty
                entries.append(f"{name},{pct:.2f},{price:.2f},{unit},{buy_price:.2f},{buy_qty}")
                gain_str = ""
                if buy_price > 0 and buy_qty > 0:
                    gain_pct = (price - buy_price) / buy_price * 100
                    gain_amt = (price - buy_price) * buy_qty
                    gain_str = f"  매수대비 {gain_pct:+.2f}% ({gain_amt:+.0f}{unit})"
                print(f"  {name}: {unit}{price:.0f}  {pct:+.2f}%{gain_str}")
        except Exception as e:
            print(f"  {ticker} 오류: {e}")
    return "|".join(entries)


async def run():
    print(f"'{DEVICE_NAME}' 검색 중...")
    device = await BleakScanner.find_device_by_name(DEVICE_NAME, timeout=30)
    if not device:
        print("장치를 찾을 수 없어요. ESP32가 켜져 있는지 확인하세요.")
        return

    print(f"연결 중: {device.address}")
    async with BleakClient(device, timeout=15) as client:
        print("BLE 연결 성공!")
        while True:
            print("\n주가 수집 중...")
            payload = fetch_all()
            if payload:
                data = payload.encode("utf-8")
                # MTU 때문에 512바이트씩 나눠서 전송
                chunk = 512
                for i in range(0, len(data), chunk):
                    await client.write_gatt_char(CHAR_UUID, data[i:i+chunk])
                print(f"전송 완료 ({len(data)}bytes)")
            print(f"{INTERVAL // 60}분 후 다시 전송...")
            await asyncio.sleep(INTERVAL)


if __name__ == "__main__":
    asyncio.run(run())
