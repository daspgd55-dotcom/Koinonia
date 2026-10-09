from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class Source(StrictModel):
    id: str
    title: str
    url: str | None = None
    text: str | None = None

class Candidate(StrictModel):
    churchId: str
    score: float = Field(ge=0, le=1)
    components: dict[str, float]
    identification: dict = Field(default_factory=dict)
    doctrine: dict = Field(default_factory=dict)
    community: dict = Field(default_factory=dict)
    sources: list[Source] = Field(default_factory=list)

class RecommendationRequest(StrictModel):
    version: Literal["1"]
    query: str = Field(default="", max_length=2000)
    preferences: dict = Field(default_factory=dict)
    candidates: list[Candidate] = Field(default_factory=list, max_length=100)

class Explanation(StrictModel):
    churchId: str
    explanation: str
    sourceIds: list[str]

class RecommendationResponse(StrictModel):
    engine: Literal["baseline", "rag"]
    results: list[Explanation]
