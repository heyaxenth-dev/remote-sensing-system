"""Heuristic seedling recommendation from a scene photo (mirrors lib/seedlingAnalysisLocal.js)."""

from __future__ import annotations

import json
import math
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "seedling-catalog.json"


def _clamp01(x: float) -> float:
    if math.isnan(x):
        return 0.0
    return max(0.0, min(1.0, x))


def _load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def compute_signals_from_image(img: Image.Image) -> dict[str, float]:
    img = img.convert("RGB")
    w, h = img.size
    img_small = img.resize(
        (max(32, min(w, 96)), max(24, min(h, 72))), Image.Resampling.BILINEAR
    )
    w, h = img_small.size
    stride = max(4, round(min(w, h) / 48))

    total = 0
    greenish = 0
    sum_r = sum_g = sum_b = 0.0
    sum_lum = 0.0

    px = img_small.load()
    for y in range(0, h, stride):
        for x in range(0, w, stride):
            r, g, b = px[x, y]
            total += 1
            sum_r += r
            sum_g += g
            sum_b += b
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            sum_lum += lum
            if g > r + 12 and g > b + 12:
                greenish += 1

    if total == 0:
        return {
            "vegetationIndex": 0.0,
            "openSunIndex": 0.5,
            "moistureHint": 0.5,
            "greenRatio": 0.0,
            "meanLuminance": 0.5,
        }

    green_ratio = greenish / total
    mean_r = sum_r / total
    mean_g = sum_g / total
    mean_b = sum_b / total
    mean_lum = sum_lum / total
    denom = max(1.0, mean_r + mean_g + mean_b)
    open_sun = _clamp01(mean_lum * 0.65 + (1.0 - green_ratio) * 0.35)
    moisture = _clamp01(
        (mean_b / denom) * 3 * 0.42 + green_ratio * 0.33 + mean_lum * 0.25
    )

    return {
        "vegetationIndex": _clamp01(green_ratio),
        "openSunIndex": open_sun,
        "moistureHint": moisture,
        "greenRatio": _clamp01(green_ratio),
        "meanLuminance": _clamp01(mean_lum),
    }


def _penalty(seedling: dict[str, Any], signals: dict[str, float]) -> float:
    penalty = 0.0
    prefs = seedling.get("preferences") or {}
    for key, spec in prefs.items():
        if key not in signals or spec.get("ideal") is None:
            continue
        w = float(spec.get("weight", 1))
        d = signals[key] - float(spec["ideal"])
        penalty += w * d * d
    return penalty


def _to_public(seedling: dict[str, Any]) -> dict[str, str]:
    return {
        "id": seedling["id"],
        "commonName": seedling["commonName"],
        "scientificName": seedling["scientificName"],
        "notes": seedling["notes"],
    }


def _rationale(signals: dict[str, float], top: dict[str, Any]) -> str:
    veg = round(signals["vegetationIndex"] * 100)
    sun = round(signals["openSunIndex"] * 100)
    wet = round(signals["moistureHint"] * 100)
    return (
        f"Scene cues: vegetation ~{veg}%, open-sun exposure ~{sun}%, "
        f"moisture proxy ~{wet}%. Best match: {top['commonName']} — {top['notes']}"
    )


def recommend_from_bytes(
    image_bytes: bytes, latitude: float | None, longitude: float | None
) -> dict[str, Any]:
    catalog = _load_catalog()
    img = Image.open(BytesIO(image_bytes))
    signals = compute_signals_from_image(img)

    items = [(s, _penalty(s, signals)) for s in catalog["seedlings"]]
    items.sort(key=lambda x: x[1])
    max_p = max((p for _, p in items), default=1e-6)
    best, best_p = items[0]
    confidence = _clamp01(1.0 - best_p / (max_p * 1.35))

    out = {
        "source": "remote",
        "recommended": _to_public(best),
        "alternatives": [_to_public(s) for s, _ in items[1:4]],
        "confidence": confidence,
        "rationale": _rationale(signals, best),
        "signals": {**signals},
    }
    if latitude is not None and longitude is not None:
        out["signals"]["latitude"] = latitude
        out["signals"]["longitude"] = longitude
    return out
