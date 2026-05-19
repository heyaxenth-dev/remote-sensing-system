"""FastAPI service: POST /analyze with JSON { image_base64, latitude?, longitude? }."""

from __future__ import annotations

import base64

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from recommend import recommend_from_bytes

app = FastAPI(title="Seedling scene analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeBody(BaseModel):
    image_base64: str = Field(..., min_length=32)
    latitude: float | None = None
    longitude: float | None = None
    area_m2: float | None = None
    penro_plot: dict | None = None


@app.post("/analyze")
def analyze(body: AnalyzeBody) -> dict:
    raw = base64.b64decode(body.image_base64)
    return recommend_from_bytes(
        raw,
        body.latitude,
        body.longitude,
        area_m2=body.area_m2,
        penro_plot=body.penro_plot,
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True}
