from models.schemas import Explanation, RecommendationRequest, RecommendationResponse

def recommend(request: RecommendationRequest) -> RecommendationResponse:
    # Adaptador de referencia. No simula RAG ni interpretación de lenguaje natural.
    results = [Explanation(
        churchId=c.churchId,
        explanation=f"Compatibilidad estructurada: {c.score:.3f}. Criterios: " +
            ", ".join(f"{key}={value:.2f}" for key, value in c.components.items()) +
            ". La consulta libre no se interpreta en este adaptador.",
        sourceIds=[]
    ) for c in request.candidates]
    return RecommendationResponse(engine="baseline", results=results)
