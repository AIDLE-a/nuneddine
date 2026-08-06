# BE/embedding.py — 로컬 임베딩 (Groq/OpenAI API 안 씀, 무료·빠름)
from sentence_transformers import SentenceTransformer

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("jhgan/ko-sroberta-multitask")  # 한국어 특화 로컬 모델
    return _model

def embed_text(text: str) -> list[float]:
    return get_model().encode(text).tolist()