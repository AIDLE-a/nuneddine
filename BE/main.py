from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, auth

app = FastAPI()

# 💡 프론트엔드(React) 서버와의 통신을 허용하는 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 대회 개발 중에는 편의상 모두 허용합니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 💡 Firebase Admin SDK 초기화 (JSON 파일 이름이 똑같아야 해요!)
try:
    cred = credentials.Certificate("firebase_config.json")
    firebase_admin.initialize_app(cred)
    print("🚀 Firebase Admin SDK 초기화 성공!")
except Exception as e:
    print(f"❌ Firebase 초기화 실패 (파일이 BE 폴더에 있는지 확인하세요): {e}")

# 💡 프론트엔드에서 보낸 로그인 토큰을 검증하는 API 주소
@app.post("/api/login")
async def login_check(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="인증 헤더(Authorization)가 누락되었습니다.")
    
    try:
        # 'Bearer <토큰>' 형태에서 토큰 문자열만 쏙 분리하기
        token_type, token = authorization.split(" ")
        if token_type.lower() != "bearer":
            raise HTTPException(status_code=401, detail="올바른 Bearer 토큰 형식이 아닙니다.")
        
        # 🔒 Firebase 서버를 통해 토큰의 위조 여부 검증
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        email = decoded_token.get('email', '이메일 없음')
        
        # 검증이 끝나면 리액트에게 유저 정보를 응답으로 넘겨줌
        return {
            "status": "success",
            "message": "백엔드인증에 성공했습니다!",
            "user": {
                "uid": uid,
                "email": email
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"유효하지 않은 토큰입니다: {str(e)}")