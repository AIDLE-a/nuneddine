<<<<<<< HEAD
# nuneddine
=======
# NuneDDine — 주식 AI 리서치 플랫폼

> 종목 검색 → 뉴스 수집 → 감성 분석 → 주가 예측 → 신뢰도 경고까지 한 화면에

**"AI가 자기 한계를 아는 시스템"** — 각 에이전트가 스스로 불확실성을 보고하고, Critic 에이전트가 이를 모아 최종 신뢰도를 산출합니다.  
+ ESP32 BLE 다마고치 키링과 연동해 관심 종목 등락률을 캐릭터 표정으로 실시간 확인할 수 있습니다.

---

## 👥 팀 역할

| 팀원 | 역할 | 담당 코드 |
|------|------|-----------|
| 채민 | FE 리더 — React 대시보드, 라우팅, Firebase 연동, BLE 아두이노 | `FE/src/`, `arduino/` |
| 희선 | BE 리더 — FastAPI 오케스트레이터, Prophet 예측, Critic 에이전트 | `BE/main.py`, `BE/heesun_*.py`, `BE/critic.py` |
| 유빈 | 데이터 수집 — yfinance 주가, Naver·Google·NewsAPI 뉴스 수집 | `BE/yubin_*.py` |
| 연우 | AI/ML — FinBERT 감성분석, XAI(단어 기여도), 트렌드·변동성 분석 | `BE/yeonwoo_*.py` |

---

## 🏗️ 프로젝트 구조

```
it_26/
├── FE/                              # React + Vite 프론트엔드
│   └── src/
│       ├── App.jsx                  # 루트 — React Router + 전역 상태 관리
│       ├── App.css                  # 전역 스타일 (CSS 토큰 기반 다크/라이트)
│       ├── Sidebar.jsx              # 사이드바 네비게이션 + 로그인/로그아웃
│       ├── WatchlistPanel.jsx       # 관심종목 · 최근분석 · 연관종목 패널
│       ├── SummaryCards.jsx         # 현재가 / 예측가 / 감성 / 뉴스수 카드
│       ├── StockChartCard.jsx       # recharts 주가 흐름 + 7일 예측 차트
│       ├── ReliabilityCard.jsx      # 종합 신뢰도 도넛 + 프로그레스 바
│       ├── SentimentCard.jsx        # 감성 분석 바차트 + XAI 기여도
│       ├── RecentNewsCard.jsx       # 최근 뉴스 목록
│       ├── AiReportCard.jsx         # AI 리포트 + 경고 배너
│       ├── api.js                   # BE API 호출 함수
│       ├── firebase.js              # Firebase Auth + Firestore 헬퍼
│       ├── currencyUtils.js         # 원/달러 통화 자동 감지 + 포맷
│       ├── components/
│       │   ├── NotificationBell.jsx
│       │   └── PhotoCropModal.jsx
│       └── pages/
│           ├── AnalysisPage.jsx     # 메인 분석 페이지 (/)
│           ├── CommunityPage.jsx    # 커뮤니티 (/community)
│           ├── PostDetailPage.jsx   # 게시글 상세 (/community/:id)
│           ├── RankingPage.jsx      # 인기 종목 (/ranking)
│           ├── FavoritesPage.jsx    # 관심 종목 (/favorites)
│           ├── HistoryPage.jsx      # 분석 기록 (/history)
│           └── MyPage.jsx           # 마이페이지 (/mypage)
│
├── BE/                              # FastAPI 백엔드
│   ├── main.py                      # 통합 서버 — 모든 API 엔드포인트
│   ├── schemas.py                   # 팀 공통 데이터 계약 (Pydantic)
│   ├── critic.py                    # Critic 에이전트 — 최종 신뢰도 산출
│   ├── heesun_forecast.py           # 희선: Prophet 주가 예측
│   ├── heesun_prediction.py         # 희선: 예측 서비스 래퍼
│   ├── yeonwoo_sentiment.py         # 연우: FinBERT 가중치 감성분석 + 트렌드/변동성
│   ├── yeonwoo_xai.py               # 연우: Leave-one-out XAI 단어 기여도
│   ├── yubin_data.py                # 유빈: 뉴스 수집 (Naver·Google RSS·yfinance·NewsAPI)
│   ├── yubin_filter.py              # 유빈: 뉴스 필터링
│   ├── yubin_news.py                # 유빈: 뉴스 처리 유틸
│   ├── yubin_stock.py               # 유빈: 주가 데이터 수집
│   └── requirements.txt             # Python 의존성
│
└── arduino/                         # ESP32 BLE 다마고치 키링
    ├── tamagotchi_esp32/
    │   └── tamagotchi_esp32.ino     # ESP32-C3 Arduino 스케치
    ├── tamagotchi_uno/
    │   └── tamagotchi_uno.ino       # Arduino UNO 버전
    ├── ble_sender.py                # PC → ESP32 BLE 송신 스크립트
    └── README.md                    # 아두이노 핀 연결 및 동작 설명
```

---

## 🚀 실행 방법

### 백엔드

```bash
cd BE
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

### 프론트엔드

```bash
cd FE
npm install
npm run dev
# → http://localhost:5174
```

### BLE 다마고치 (선택)

```bash
# ESP32에 tamagotchi_esp32.ino 업로드 후
cd arduino
pip install bleak requests yfinance
python ble_sender.py
```

> BE가 꺼져 있어도 FE는 목데이터로 동작합니다.  
> BE 실행 후 종목 검색 → "분석 시작" 버튼을 누르면 실제 분석 결과로 전환됩니다.

---

## 🔌 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/health` | 서버 상태 확인 |
| `POST` | `/api/login` | Firebase 토큰 검증 (구글 로그인) |
| `GET` | `/api/analyze?ticker=005930.KS` | 종목 분석 (뉴스→감성→예측→신뢰도) |
| `GET` | `/api/search?q=삼성전자` | 전 세계 종목 검색 (한국어 지원) |
| `GET` | `/api/related?ticker=005930.KS` | 연관 종목 추천 (섹터 기반) |
| `GET` | `/api/prices?tickers=005930.KS,TSLA` | 현재가 일괄 조회 |
| `GET` | `/api/active-user` | 현재 로그인된 UID 조회 (BLE용) |
| `POST` | `/api/active-user` | 로그인/로그아웃 시 UID 갱신 (BLE용) |
| `GET` | `/api/watchlist?uid=...` | Firestore 관심 종목 조회 (BLE용) |
| `GET` | `/api/tamagotchi?ticker=005930.KS` | 현재가 + 등락률 조회 (BLE용) |

### `/api/analyze` 응답 예시

```json
{
  "ticker": "005930.KS",
  "price": 72400,
  "news": [{ "title": "...", "source": "한국경제", "url": "...", "published_at": "..." }],
  "prediction": { "future_price": 73500, "lower": 70000, "upper": 76000 },
  "sentiment": { "positive": 0.65, "negative": 0.35 },
  "trend": { "direction": "긍정 방향으로 개선 중", "recent_score": 0.71, "change": 0.16 },
  "warnings": ["감성 신호 불명확"],
  "confidence_score": 68,
  "explanation": [{ "word": "차세대 양산", "contribution": 0.31 }]
}
```

---

## ⚙️ 환경변수

### BE — `.env` 파일 (BE/ 폴더에 생성)

```env
USE_MOCK_DATA=true        # false로 바꾸면 실제 API 호출
NEWS_API_KEY=your_key     # https://newsapi.org 에서 발급
NAVER_CLIENT_ID=your_key  # https://developers.naver.com 에서 발급
NAVER_CLIENT_SECRET=your_key
```

### FE — `.env` 파일 (FE/ 폴더에 생성)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> `.env` 파일은 절대 커밋하지 마세요 (gitignore에 포함됨).

---

## 🔄 데이터 흐름

```
사용자 (종목 검색)
  ↓
[FE] AnalysisPage → analyzeStock(ticker)
  ↓ HTTP GET /api/analyze
[BE] main.py (오케스트레이터 — 희선)
  ├─ yubin_data.get_news()           → 뉴스 수집 (Naver·Google·yfinance·NewsAPI)
  ├─ yubin_stock.get_price()         → 주가 데이터 (yfinance)
  ├─ yeonwoo_sentiment.analyze()    → 가중치 감성분석 + 트렌드 + 변동성 (연우)
  ├─ heesun_prediction.predict()    → Prophet 7일 예측 (희선)
  └─ critic.review()                 → 경고 목록 + 신뢰도 점수 (희선)
  ↓
[FE] 화면 업데이트
  ├─ SummaryCards    — 현재가 / 예측가 / 감성방향 / 뉴스수
  ├─ StockChartCard  — 실제 주가 + 예측가 점선 차트
  ├─ ReliabilityCard — 종합 신뢰도 점수
  ├─ SentimentCard   — 긍정/부정/중립 % + XAI 단어 기여도
  ├─ RecentNewsCard  — 최신 뉴스 목록
  └─ AiReportCard    — AI 리포트 + 경고 배너

[BLE 연동]
  FE 로그인 → /api/active-user 갱신
  ble_sender.py → /api/watchlist → /api/tamagotchi → ESP32 전송
  ESP32 → TFT 캐릭터 표정 표시 (등락률 기반)
```

---

## 📅 개발 일정

| 주차 | 목표 |
|------|------|
| 1주차 | 각 기능 단독 성공, API 계약 확정 |
| 2주차 | 전체 연결 (`USE_MOCK_DATA=false` 전환) |
| 3주차 | 감성분석 고도화 (가중치·트렌드·변동성), BLE 다마고치 완성 |
| 4주차 | UI 다듬기, 커뮤니티·랭킹 기능 완성, 발표 시나리오 준비 |

> **매주 토요일**: "삼성전자" 입력 → 전체 동작 통합 테스트 필수
>>>>>>> origin/FE_CHAEMIN
