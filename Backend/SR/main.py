import hmac
import os
from fastapi import FastAPI, Header, HTTPException
from models.schemas import RecommendationRequest, RecommendationResponse
from services.recommender import recommend

app = FastAPI(title="Koinonía - adaptador de recomendación", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "engine": "baseline"}

@app.post("/recommend", response_model=RecommendationResponse)
def recommendations(payload: RecommendationRequest, authorization: str | None = Header(default=None)):
    secret = os.getenv("RECOMMENDER_TOKEN")
    if secret and not hmac.compare_digest(authorization or "", "Bearer " + secret):
        raise HTTPException(status_code=401, detail="Token inválido")
    return recommend(payload)
