"""Heuristic seedling recommendation from a scene photo (mirrors lib/seedlingAnalysisLocal.js)."""

from __future__ import annotations

import json
import math
import os
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

OPEN_METEO_FORECAST_URL = os.environ.get(
    "OPEN_METEO_FORECAST_URL", "https://api.open-meteo.com/v1/forecast"
)

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "seedling-catalog.json"


def _clamp01(x: float) -> float:
    if math.isnan(x):
        return 0.0
    return max(0.0, min(1.0, x))


def _load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _safe_float(x: Any) -> float | None:
    try:
        if x is None:
            return None
        if isinstance(x, bool):
            return None
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def _clamp(x: float, lo: float, hi: float) -> float:
    if math.isnan(x):
        return lo
    return max(lo, min(hi, x))


def _norm01(x: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return _clamp01((x - lo) / (hi - lo))


def _fetch_weather_signals(latitude: float, longitude: float) -> dict[str, float]:
    """
    Pulls a small set of current weather signals from Open-Meteo.
    This is intentionally dependency-free (urllib) and fails soft (returns {}).
    """
    try:
        qs = urllib.parse.urlencode(
            {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            }
        )
        url = f"{OPEN_METEO_FORECAST_URL}?{qs}"
        with urllib.request.urlopen(url, timeout=5) as resp:  # nosec - fixed host
            payload = json.loads(resp.read().decode("utf-8"))

        cur = payload.get("current") or {}
        temp_c = _safe_float(cur.get("temperature_2m"))
        rh = _safe_float(cur.get("relative_humidity_2m"))
        precip_mm = _safe_float(cur.get("precipitation"))
        wind_ms = _safe_float(cur.get("wind_speed_10m"))

        out: dict[str, float] = {}
        if temp_c is not None:
            # 10C -> 0, 35C -> 1 (tropical-ish range)
            out["heatIndex"] = _norm01(temp_c, 10.0, 35.0)
            out["temperatureC"] = float(temp_c)
        if rh is not None:
            out["humidityIndex"] = _clamp01(rh / 100.0)
            out["humidityPct"] = float(rh)
        if precip_mm is not None:
            # treat as "wetness now": 0mm -> 0, 8mm -> 1
            out["rainIndex"] = _norm01(precip_mm, 0.0, 8.0)
            out["precipitationMm"] = float(precip_mm)
        if wind_ms is not None:
            out["windIndex"] = _norm01(wind_ms, 0.0, 15.0)
            out["windSpeedMs"] = float(wind_ms)
        return out
    except Exception:
        return {}


def _compute_area_soil_signals(
    *,
    area_m2: float | None,
    soil: dict[str, Any] | None,
) -> dict[str, float]:
    soil = soil or {}
    ph = _safe_float(soil.get("ph"))
    drainage = soil.get("drainage")  # "poor" | "medium" | "good"
    texture = soil.get("texture")  # "sandy" | "loam" | "clay"

    out: dict[str, float] = {}

    if area_m2 is not None:
        # Small plots bias toward smaller footprint / faster feedback loops.
        # 0..1 = small..large. 0 at 50m², 1 at 2ha.
        out["areaIndex"] = _norm01(area_m2, 50.0, 20_000.0)
        out["areaM2"] = float(area_m2)

    if ph is not None:
        # Most seedlings like mildly acidic to neutral; center at ~6.5
        # Store as both raw pH and a "goodness" index (1 near 6.5, 0 at extremes).
        out["soilPh"] = float(ph)
        out["soilPhFit"] = _clamp01(1.0 - abs(ph - 6.5) / 2.5)

    drainage_map = {"poor": 0.15, "medium": 0.55, "good": 0.85}
    if isinstance(drainage, str):
        v = drainage_map.get(drainage.strip().lower())
        if v is not None:
            out["drainageIndex"] = float(v)

    texture_map = {"sandy": 0.25, "loam": 0.6, "clay": 0.8}
    if isinstance(texture, str):
        v = texture_map.get(texture.strip().lower())
        if v is not None:
            out["textureIndex"] = float(v)

    return out


def _environment_profile(seedling: dict[str, Any]) -> dict[str, dict[str, float]]:
    """
    Heuristic ideals for non-image context (weather/area/soil) per seedling.
    Values are 0..1 indices that match signals we compute above.
    """
    sid = (seedling.get("id") or "").strip().lower()

    # Defaults are neutral / low weight to avoid overfitting.
    base = {
        "humidityIndex": {"ideal": 0.55, "weight": 0.25},
        "rainIndex": {"ideal": 0.45, "weight": 0.25},
        "heatIndex": {"ideal": 0.6, "weight": 0.2},
        "windIndex": {"ideal": 0.45, "weight": 0.1},
        "areaIndex": {"ideal": 0.55, "weight": 0.15},
        "drainageIndex": {"ideal": 0.6, "weight": 0.25},
        "soilPhFit": {"ideal": 0.85, "weight": 0.2},
        "textureIndex": {"ideal": 0.55, "weight": 0.1},
    }

    if sid == "bamboo":
        base |= {
            "humidityIndex": {"ideal": 0.8, "weight": 0.65},
            "rainIndex": {"ideal": 0.75, "weight": 0.7},
            "drainageIndex": {"ideal": 0.45, "weight": 0.35},  # tolerates wetter soils
            "areaIndex": {"ideal": 0.75, "weight": 0.25},
        }
    elif sid == "moringa":
        base |= {
            "humidityIndex": {"ideal": 0.45, "weight": 0.45},
            "rainIndex": {"ideal": 0.25, "weight": 0.55},
            "drainageIndex": {"ideal": 0.8, "weight": 0.55},
            "heatIndex": {"ideal": 0.7, "weight": 0.35},
            "areaIndex": {"ideal": 0.35, "weight": 0.2},
        }
    elif sid == "molave":
        base |= {
            "humidityIndex": {"ideal": 0.4, "weight": 0.55},
            "rainIndex": {"ideal": 0.2, "weight": 0.65},
            "drainageIndex": {"ideal": 0.85, "weight": 0.6},
            "heatIndex": {"ideal": 0.7, "weight": 0.35},
        }
    elif sid == "narra":
        base |= {
            "humidityIndex": {"ideal": 0.6, "weight": 0.35},
            "rainIndex": {"ideal": 0.45, "weight": 0.35},
            "drainageIndex": {"ideal": 0.65, "weight": 0.35},
            "areaIndex": {"ideal": 0.6, "weight": 0.2},
        }

    return base


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
    sum_lum2 = 0.0
    sum_chroma = 0.0

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
            sum_lum2 += lum * lum
            mx = max(r, g, b)
            mn = min(r, g, b)
            sum_chroma += (mx - mn) / 255.0
            if g > r + 12 and g > b + 12:
                greenish += 1

    if total == 0:
        return {
            "vegetationIndex": 0.0,
            "openSunIndex": 0.5,
            "moistureHint": 0.5,
            "greenRatio": 0.0,
            "meanLuminance": 0.5,
            "concreteLikelihood": 0.5,
            "surfaceChroma": 0.5,
            "luminanceStd": 0.2,
        }

    green_ratio = greenish / total
    mean_r = sum_r / total
    mean_g = sum_g / total
    mean_b = sum_b / total
    mean_lum = sum_lum / total
    var_lum = max(0.0, sum_lum2 / total - mean_lum * mean_lum)
    lum_std = math.sqrt(var_lum)
    mean_chroma = sum_chroma / total
    denom = max(1.0, mean_r + mean_g + mean_b)
    open_sun = _clamp01(mean_lum * 0.65 + (1.0 - green_ratio) * 0.35)
    moisture = _clamp01(
        (mean_b / denom) * 3 * 0.42 + green_ratio * 0.33 + mean_lum * 0.25
    )

    # Uniform / low-chroma scenes (concrete, asphalt, painted flat surfaces).
    uniformity = _clamp01(1.0 - min(1.0, lum_std * 4.0))
    gray_band = _clamp01(1.0 - abs(mean_lum - 0.48) / 0.38)
    concrete_likelihood = _clamp01(
        (1.0 - green_ratio) * 0.38
        + (1.0 - mean_chroma) * 0.32
        + uniformity * 0.22
        + gray_band * 0.18
    )

    return {
        "vegetationIndex": _clamp01(green_ratio),
        "openSunIndex": open_sun,
        "moistureHint": moisture,
        "greenRatio": _clamp01(green_ratio),
        "meanLuminance": _clamp01(mean_lum),
        "concreteLikelihood": concrete_likelihood,
        "surfaceChroma": _clamp01(mean_chroma),
        "luminanceStd": float(min(1.0, lum_std * 2.5)),
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

    # Extra context-driven penalty (weather/area/soil). Only applies when those signals exist.
    env = _environment_profile(seedling)
    for key, spec in env.items():
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


def _unsuitable_for_planting(signals: dict[str, float]) -> tuple[bool, str]:
    veg = float(signals.get("vegetationIndex", 0.0))
    conc = float(signals.get("concreteLikelihood", 0.0))
    if conc >= 0.68 and veg < 0.12:
        return (
            True,
            "This capture looks like hardscape (concrete/asphalt): very low vegetation "
            "and flat, low-color cues. Seedlings need soil—not paved surfaces.",
        )
    if conc >= 0.78:
        return (
            True,
            "Surface cues strongly resemble concrete or other impervious cover. "
            "A seedling recommendation cannot be generated for this scene.",
        )
    return False, ""


def _match_percent(penalty: float, max_p: float) -> int:
    return int(round(100.0 * _clamp01(1.0 - penalty / (max_p * 1.35))))


def _rationale(signals: dict[str, float], top: dict[str, Any]) -> str:
    veg = round(signals["vegetationIndex"] * 100)
    sun = round(signals["openSunIndex"] * 100)
    wet = round(signals["moistureHint"] * 100)
    parts = [
        f"Scene cues: vegetation ~{veg}%, open-sun exposure ~{sun}%, moisture proxy ~{wet}%.",
    ]
    if "temperatureC" in signals or "humidityPct" in signals or "precipitationMm" in signals:
        temp = f"{signals.get('temperatureC', float('nan')):.0f}°C" if "temperatureC" in signals else "n/a"
        hum = f"{signals.get('humidityPct', float('nan')):.0f}%" if "humidityPct" in signals else "n/a"
        rain = f"{signals.get('precipitationMm', float('nan')):.1f}mm" if "precipitationMm" in signals else "n/a"
        parts.append(f"Weather now: temp {temp}, humidity {hum}, precip {rain}.")
    if "areaM2" in signals:
        parts.append(f"Area: ~{signals['areaM2']:.0f} m².")
    if "soilPh" in signals or "drainageIndex" in signals or "textureIndex" in signals:
        soil_bits = []
        if "soilPh" in signals:
            soil_bits.append(f"pH {signals['soilPh']:.1f}")
        if "drainageIndex" in signals:
            soil_bits.append("drainage considered")
        if "textureIndex" in signals:
            soil_bits.append("texture considered")
        if soil_bits:
            parts.append("Soil: " + ", ".join(soil_bits) + ".")

    parts.append(f"Best match: {top['commonName']} — {top['notes']}")
    return " ".join(parts)


_DEFAULT_CAPTURE_AREA_M2 = 250.0
_SEEDLING_SPACING_M2 = 4.0


def _estimated_seedlings_needed(signals: dict[str, Any]) -> int:
    """Heuristic stocking count from assessed plot area (~2 m × 2 m spacing when area is known)."""
    raw = signals.get("areaM2")
    try:
        area = float(raw) if raw is not None else _DEFAULT_CAPTURE_AREA_M2
    except (TypeError, ValueError):
        area = _DEFAULT_CAPTURE_AREA_M2
    return max(1, int(math.ceil(area / _SEEDLING_SPACING_M2)))


def recommend_from_bytes(
    image_bytes: bytes,
    latitude: float | None,
    longitude: float | None,
    *,
    area_m2: float | None = None,
    soil: dict[str, Any] | None = None,
) -> dict[str, Any]:
    catalog = _load_catalog()
    img = Image.open(BytesIO(image_bytes))
    signals = compute_signals_from_image(img)

    # Environment signals (GrowCalendar-style context: weather + declared soil/area).
    if latitude is not None and longitude is not None:
        signals |= _fetch_weather_signals(latitude, longitude)
    signals |= _compute_area_soil_signals(area_m2=area_m2, soil=soil)

    penalties = [(s, _penalty(s, signals)) for s in catalog["seedlings"]]
    penalties.sort(key=lambda x: x[1])
    max_p = max((p for _, p in penalties), default=1e-6)
    ranked_seedlings = [
        {"seedling": _to_public(s), "matchPercent": _match_percent(p, max_p)}
        for s, p in penalties
    ]

    unsuitable, unsuitable_reason = _unsuitable_for_planting(signals)
    if unsuitable:
        out: dict[str, Any] = {
            "source": "remote",
            "unsuitableForPlanting": True,
            "unsuitableReason": unsuitable_reason,
            "recommended": None,
            "alternatives": [],
            "rankedSeedlings": [],
            "confidence": 0.0,
            "rationale": unsuitable_reason,
            "signals": {**signals},
        }
        if latitude is not None and longitude is not None:
            out["signals"]["latitude"] = latitude
            out["signals"]["longitude"] = longitude
        out["estimatedSeedlingsNeeded"] = _estimated_seedlings_needed(out["signals"])
        return out

    best, best_p = penalties[0]
    confidence = _clamp01(1.0 - best_p / (max_p * 1.35))

    out = {
        "source": "remote",
        "unsuitableForPlanting": False,
        "unsuitableReason": None,
        "recommended": _to_public(best),
        "alternatives": [_to_public(s) for s, _ in penalties[1:4]],
        "rankedSeedlings": ranked_seedlings,
        "confidence": confidence,
        "rationale": _rationale(signals, best),
        "signals": {**signals},
    }
    if latitude is not None and longitude is not None:
        out["signals"]["latitude"] = latitude
        out["signals"]["longitude"] = longitude
    out["estimatedSeedlingsNeeded"] = _estimated_seedlings_needed(out["signals"])
    return out
