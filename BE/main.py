"""
통합 FastAPI 서버
- /api/login  : Firebase 구글 로그인 검증 (담당: 채민/로그인팀)
- /api/analyze: 주식 분석 오케스트레이터 (담당: 희선)
               뉴스 수집(유빈) → 감성분석(연우) → 예측(희선) → Critic(희선)

실행: uvicorn main:app --reload
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from schemas import StockAnalysisResponse
import yubin_data as data_service
import yeonwoo_sentiment as sentiment_service
import heesun_prediction as prediction_service
import critic

app = FastAPI(title="주식 리서치 통합 서버")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Firebase Admin SDK 초기화 (firebase_config.json 파일이 BE/ 폴더에 있어야 함)
try:
    cred = credentials.Certificate("firebase_config.json")
    firebase_admin.initialize_app(cred)
    print("🚀 Firebase Admin SDK 초기화 성공!")
except Exception as e:
    print(f"⚠️  Firebase 초기화 실패 (로그인 기능 비활성화): {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


# ── 채민 / 로그인팀 담당 ──
@app.post("/api/login")
async def login_check(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="인증 헤더(Authorization)가 누락되었습니다.")
    try:
        token_type, token = authorization.split(" ", 1)
        if token_type.lower() != "bearer":
            raise HTTPException(status_code=401, detail="올바른 Bearer 토큰 형식이 아닙니다.")
        decoded_token = firebase_auth.verify_id_token(token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "이메일 없음")
        return {
            "status": "success",
            "message": "백엔드 인증 성공!",
            "user": {"uid": uid, "email": email},
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"유효하지 않은 토큰입니다: {str(e)}")


# ── 희선 담당 (오케스트레이터) ──
@app.get("/api/analyze", response_model=StockAnalysisResponse)
def analyze(ticker: str = "005930.KS"):
    try:
        # 1. 뉴스/주가 수집 (유빈)
        data_result = data_service.get_stock_data(ticker)

        # 2. 감성 분석 (연우 - FinBERT)
        sentiment_result = sentiment_service.analyze(data_result.news)

        # 3. 주가 예측 (희선 - Prophet)
        prediction_result = prediction_service.predict(
            ticker, data_result.price, sentiment_result.sentiment
        )

        # 4. Critic 에이전트 — 최종 신뢰도 산출 (희선)
        warnings, confidence_score = critic.review(
            data_result, sentiment_result, prediction_result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return StockAnalysisResponse(
        ticker=data_result.ticker,
        price=data_result.price,
        price_history=data_result.price_history,
        news=data_result.news,
        prediction=prediction_result.prediction,
        sentiment=sentiment_result.sentiment,
        warnings=warnings,
        confidence_score=confidence_score,
        explanation=sentiment_result.explanation,
    )
