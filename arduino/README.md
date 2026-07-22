# NuneDDine 다마고치 — Arduino

ESP32-C3 Super Mini + ST7735 TFT + BLE로 구현한 주식 연동 다마고치 키링.  
누네띄네 웹앱의 관심 종목 주가를 BLE로 수신해 캐릭터 표정으로 표시한다.

---

## 파일 구성

```
arduino/
├── tamagotchi_esp32/
│   └── tamagotchi_esp32.ino   # 메인 Arduino 스케치
└── ble_sender.py               # PC → ESP32 BLE 송신 스크립트 (Python)
```

---

## 사용 부품

| 부품 | 설명 |
|------|------|
| ESP32-C3 Super Mini | 메인 MCU, BLE 내장 |
| ST7735 TFT (128×160) | 1.8인치 컬러 디스플레이 |
| 부저 (Buzzer) | 상태 변화 알림음 |
| 순간접촉 푸시버튼 | 종목 전환 버튼 |
| ON/OFF 토글 스위치 | 무음 모드 스위치 |
| 소형 보조배터리 | 전원 공급 |

---

## 핀 연결

### ST7735 TFT 디스플레이

| TFT 핀 | ESP32-C3 GPIO |
|--------|--------------|
| SCLK | GPIO 4 |
| MOSI | GPIO 6 |
| CS | GPIO 7 |
| DC | GPIO 3 |
| RST | GPIO 10 |
| VCC | 3.3V |
| GND | GND |

### 부저

| 핀 | ESP32-C3 GPIO |
|----|--------------|
| + (양극) | GPIO 5 |
| - (음극) | GND |

### 버튼 1 — 종목 전환 (순간접촉 푸시버튼)

| 핀 | ESP32-C3 GPIO |
|----|--------------|
| 한쪽 | GPIO 2 |
| 다른 쪽 | GND |

### 버튼 2 — 무음 스위치 (ON/OFF 토글 스위치)

| 핀 | ESP32-C3 GPIO |
|----|--------------|
| 한쪽 | GPIO 8 |
| 다른 쪽 | GND |

---

## 라이브러리

### Arduino IDE 라이브러리 매니저 설치

| 라이브러리 | 용도 |
|-----------|------|
| Adafruit GFX Library | 디스플레이 그래픽 기본 |
| Adafruit ST7735 and ST7789 Library | ST7735 TFT 드라이버 |
| Adafruit BusIO | Adafruit 라이브러리 의존성 |

### ESP32 보드 패키지 내장 (별도 설치 불필요)

| 라이브러리 | 용도 |
|-----------|------|
| BLEDevice / BLEServer / BLEUtils / BLE2902 | BLE 통신 |
| SPI | SPI 통신 |

### Python (ble_sender.py)

```bash
pip install bleak requests yfinance
```

| 패키지 | 용도 |
|--------|------|
| bleak | BLE 통신 (PC → ESP32) |
| requests | FastAPI 백엔드 HTTP 요청 |
| yfinance | 종목 영문명 조회 |

---

## 동작 방식

1. ESP32 부팅 → BLE 광고 시작, TFT에 캐릭터 표시
2. `ble_sender.py` 실행 → ESP32에 BLE 연결
3. 5분마다 백엔드(`/api/tamagotchi`)에서 관심 종목 주가 조회
4. `종목명,등락률,현재가,통화` 형식으로 ESP32에 전송
5. 등락률에 따라 캐릭터 표정 변화

### 표정 기준

| 상태 | 등락률 | 표정 |
|------|-------|------|
| HAPPY | +2% 이상 | ^^ 눈, 하트/별/클로버 이펙트 |
| NORMAL | -0.5% ~ +2% | D자 눈, 소용돌이 이펙트 |
| TIRED | -3% ~ -0.5% | 반감은 눈, Zzz 이펙트 |
| CRYING | -6% ~ -3% | 눈물 눈, 눈물 이펙트 |
| DEAD | -6% 미만 | X 눈, 빨간 X 이펙트 |

### 버튼 동작

| 버튼 | 동작 |
|------|------|
| GPIO 2 (푸시버튼) | 관심 종목 순서대로 전환 |
| GPIO 8 (토글 스위치) | 무음 모드 ON/OFF |

---

## BLE 데이터 형식

```
종목명,등락률,현재가,통화|종목명,등락률,현재가,통화|...
```

예시:
```
SAMSUNG,2.87,72400,W|APPLE,0.30,193,..
```

- 통화: `W` (원화), `$` (달러)
- 최대 5개 종목
- 화면 하단 점(●)으로 페이지 표시, GPIO 2 버튼으로 전환
