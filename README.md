# 주식 AI 리서치 대시보드

> 종목 입력 → 뉴스 수집 → 감성 분석 → 주가 예측 → 신뢰도 경고까지 한 화면에

**"AI가 자기 한계를 아는 시스템"** — 각 에이전트가 스스로 불확실성을 보고하고, Critic 에이전트가 이를 모아 최종 신뢰도를 산출합니다.

---

## 👥 팀 역할

| 팀원 | 역할 | 담당 코드 |
|------|------|-----------|
| 채민 | FE 리더 — React 대시보드, 차트, API 연동 | `FE/src/` |
| 희선 | BE 리더 — FastAPI 오케스트레이터, Prophet 예측, Critic 에이전트 | `BE/main.py`, `BE/services/prediction_service.py`, `BE/critic.py`, `BE/tools/forecast_uncertainty.py` |
| 유빈 | 데이터 수집 — yfinance 주가, NewsAPI 뉴스 | `BE/services/data_service.py`, `BE/YUBIN/` |
| 연우 | AI/ML — FinBERT 감성분석, XAI(단어 기여도) | `BE/services/sentiment_service.py`, `BE/services/xai_service.py` |

---

## 🏗️ 프로젝트 구조

```
it_26/
├── FE/                          # React + Vite 프론트엔드
│   ├── src/
│   │   ├── api.js               # BE API 호출 함수
│   │   ├── App.jsx              # 메인 대시보드 + 상태관리
│   │   └── pages/StockDashboard/
│   │       ├── StockHeader.jsx      # 검색창 + Firebase 로그인
│   │       ├── SummaryCards.jsx     # 현재가/예측가/감성/뉴스수 요약
│   │       ├── StockChartCard.jsx   # recharts 주가 흐름 + 예측 차트
│   │       ├── ReliabilityCard.jsx  # 종합 신뢰도 도넛 + 프로그레스 바
│   │       ├── SentimentCard.jsx    # 감성 분석 바차트 + XAI 기여도
│   │       ├── RecentNewsCard.jsx   # 최근 뉴스 목록
│   │       └── AiReportCard.jsx     # AI 리포트 + 경고 배너
│   └── package.json
│
└── BE/                          # FastAPI 백엔드
    ├── main.py                  # 통합 서버 (로그인 + 분석 엔드포인트)
    ├── schemas.py               # 팀 공통 데이터 계약 (Pydantic)
    ├── critic.py                # Critic 에이전트 — 최종 신뢰도 산출
    ├── requirements.txt         # Python 의존성
    ├── firebase_config.json     # Firebase 키 (gitignore — 공유 금지)
    ├── services/
    │   ├── data_service.py      # 유빈: 주가·뉴스 수집
    │   ├── sentiment_service.py # 연우: FinBERT 감성분석
    │   ├── prediction_service.py# 희선: Prophet 주가 예측
    │   └── xai_service.py       # 연우: 단어별 감성 기여도(XAI)
    ├── tools/
    │   └── forecast_uncertainty.py  # 희선: Prophet 불확실성 점수 계산
    └── YUBIN/                   # 유빈 독립 스크립트 (수집/필터)
        ├── collect_news.py
        ├── collect_stock.py
        └── filter_news.py
```

---

## 🚀 실행 방법

### 백엔드

```bash
cd BE
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
```

### 프론트엔드

```bash
cd FE
npm install
npm run dev
# → http://localhost:5173
```

> BE가 꺼져 있어도 FE는 목데이터로 동작합니다.  
> BE 실행 시 "분석 시작 ↗" 버튼을 누르면 실제 분석 결과로 전환됩니다.

---

## 🔌 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/health` | 서버 상태 확인 |
| `POST` | `/api/login` | Firebase 토큰 검증 (구글 로그인) |
| `GET` | `/api/analyze?ticker=005930.KS` | 종목 분석 (뉴스→감성→예측→신뢰도) |

### `/api/analyze` 응답 예시

```json
{
  "ticker": "005930.KS",
  "price": 72400,
  "news": [{ "title": "...", "source": "한국경제", "url": "...", "published_at": "..." }],
  "prediction": { "future_price": 73500, "lower": 70000, "upper": 76000 },
  "sentiment": { "positive": 0.62, "negative": 0.31 },
  "warnings": ["뉴스 부족", "변동성 높음"],
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

> `firebase_config.json`은 절대 커밋하지 마세요 (gitignore에 포함됨).

---

## 🔄 데이터 흐름

```
사용자 (종목 입력)
  ↓
[FE] StockHeader → analyzeStock(ticker)
  ↓ HTTP GET /api/analyze
[BE] main.py (오케스트레이터 - 희선)
  ├─ data_service.get_stock_data()    → 주가 + 뉴스 (유빈)
  ├─ sentiment_service.analyze()      → 감성점수 + XAI (연우)
  ├─ prediction_service.predict()     → Prophet 7일 예측 (희선)
  └─ critic.review()                  → 경고 목록 + 신뢰도 점수 (희선)
  ↓
[FE] 대시보드 전체 업데이트
  ├─ SummaryCards    — 현재가 / 예측가 / 감성방향 / 뉴스수
  ├─ StockChartCard  — 실제 주가 + 예측가 점선 차트
  ├─ ReliabilityCard — 종합 신뢰도 점수
  ├─ SentimentCard   — 긍정/부정/중립 % + XAI 단어 기여도
  ├─ RecentNewsCard  — 최신 뉴스 목록
  └─ AiReportCard    — AI 리포트 + 경고 배너
```

---

## 📅 개발 일정

| 주차 | 목표 |
|------|------|
| 1주차 | 각 기능 단독 성공, API 계약 확정 |
| 2주차 | 전체 연결 (`USE_MOCK_DATA=false` 전환) |
| 3주차 | uncertainty 시스템 고도화, 경고 로직 정교화 |
| 4주차 | UI 다듬기, 발표 시나리오 준비 |

> **매주 토요일**: "삼성전자" 입력 → 전체 동작 통합 테스트 필수
