"""Heuristic seedling recommendation from a scene photo (mirrors lib/seedlingAnalysisLocal.js)."""

from __future__ import annotations

import json
import math
import os
import re
import urllib.parse
import urllib.request
from io import BytesIO
from typing import Any

from PIL import Image

from capture_validity import assess_capture_validity
from penro_species import (
    build_seedlings_from_penro_plot,
    estimate_seedlings_from_penro_plot,
)

OPEN_METEO_FORECAST_URL = os.environ.get(
    "OPEN_METEO_FORECAST_URL", "https://api.open-meteo.com/v1/forecast"
)

def _clamp01(x: float) -> float:
    if math.isnan(x):
        return 0.0
    return max(0.0, min(1.0, x))


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


def _compute_area_signals(*, area_m2: float | None) -> dict[str, float]:
    """Site area context for plantable-area monitoring (no soil database)."""
    out: dict[str, float] = {}
    if area_m2 is not None:
        out["areaIndex"] = _norm01(area_m2, 50.0, 20_000.0)
        out["areaM2"] = float(area_m2)
    return out


def _environment_profile(seedling: dict[str, Any]) -> dict[str, dict[str, float]]:
    """Heuristic weather/area ideals keyed by DENR species id token."""
    sid = (seedling.get("id") or "").strip().lower()
    base = {
        "humidityIndex": {"ideal": 0.55, "weight": 0.25},
        "rainIndex": {"ideal": 0.45, "weight": 0.25},
        "heatIndex": {"ideal": 0.6, "weight": 0.2},
        "windIndex": {"ideal": 0.45, "weight": 0.1},
        "areaIndex": {"ideal": 0.55, "weight": 0.2},
    }
    if re.search(r"kawayan|bamboo|buho", sid):
        base |= {
            "humidityIndex": {"ideal": 0.8, "weight": 0.65},
            "rainIndex": {"ideal": 0.75, "weight": 0.7},
            "areaIndex": {"ideal": 0.75, "weight": 0.25},
        }
    elif re.search(r"badlan|balod|molave|toog|narra", sid):
        base |= {
            "humidityIndex": {"ideal": 0.45, "weight": 0.5},
            "rainIndex": {"ideal": 0.3, "weight": 0.55},
            "heatIndex": {"ideal": 0.65, "weight": 0.3},
        }
    elif re.search(r"mango|jackfruit|rambutan|guyabano|duhat", sid):
        base |= {
            "humidityIndex": {"ideal": 0.5, "weight": 0.4},
            "rainIndex": {"ideal": 0.4, "weight": 0.45},
            "heatIndex": {"ideal": 0.68, "weight": 0.3},
            "areaIndex": {"ideal": 0.4, "weight": 0.2},
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
    exg_hits = 0
    sum_r = sum_g = sum_b = 0.0
    sum_lum = 0.0
    sum_lum2 = 0.0
    sum_chroma = 0.0
    edge_hits = 0
    edge_samples = 0

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
            exg = 2 * g - r - b
            if exg > 20:
                exg_hits += 1
            if x + stride < w:
                r2, g2, b2 = px[x + stride, y]
                edge_samples += 1
                if abs(r - r2) + abs(g - g2) + abs(b - b2) > 48:
                    edge_hits += 1
            if y + stride < h:
                r2, g2, b2 = px[x, y + stride]
                edge_samples += 1
                if abs(r - r2) + abs(g - g2) + abs(b - b2) > 48:
                    edge_hits += 1

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
            "organicTextureIndex": 0.0,
            "exgRatio": 0.0,
            "edgeDensity": 0.0,
            "brownIndex": 0.0,
        }

    green_ratio = greenish / total
    exg_ratio = exg_hits / total
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
    organic_texture = _clamp01(mean_chroma * 0.52 + min(1.0, lum_std * 3.4) * 0.48)
    base_concrete = _clamp01(
        (1.0 - green_ratio) * 0.38
        + (1.0 - mean_chroma) * 0.32
        + uniformity * 0.22
        + gray_band * 0.18
    )
    concrete_likelihood = _clamp01(base_concrete * (1.0 - 0.74 * organic_texture))

    vegetation_index = _clamp01(max(green_ratio, exg_ratio * 0.92))
    blue_index = _clamp01((mean_b / denom) * 3.0)
    brown_index = _clamp01((mean_r - (mean_g + mean_b) / 2.0) / 128.0)
    edge_density = _clamp01(edge_hits / edge_samples) if edge_samples else 0.0

    return {
        "vegetationIndex": vegetation_index,
        "openSunIndex": open_sun,
        "moistureHint": moisture,
        "greenRatio": _clamp01(green_ratio),
        "exgRatio": _clamp01(exg_ratio),
        "meanLuminance": _clamp01(mean_lum),
        "blueIndex": blue_index,
        "brownIndex": brown_index,
        "concreteLikelihood": concrete_likelihood,
        "surfaceChroma": _clamp01(mean_chroma),
        "luminanceStd": float(min(1.0, lum_std * 2.5)),
        "organicTextureIndex": organic_texture,
        "edgeDensity": edge_density,
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

    # Extra context-driven penalty (weather / site area). Only applies when those signals exist.
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


def _unsuitable_for_planting(
    signals: dict[str, float],
    capture_validity: dict | None = None,
) -> tuple[bool, str]:
    if capture_validity and not capture_validity.get("isValidFieldCapture", True):
        return True, str(capture_validity.get("reason") or "Not a valid field capture.")
    veg = float(signals.get("vegetationIndex", 0.0))
    conc = float(signals.get("concreteLikelihood", 0.0))
    org = float(signals.get("organicTextureIndex", 0.0))
    if conc >= 0.68 and veg < 0.12 and org < 0.26:
        return (
            True,
            "This capture looks like hardscape (concrete/asphalt): very low vegetation "
            "and flat, low-color cues. Not a plantable forest area.",
        )
    if conc >= 0.78 and org < 0.24 and veg < 0.16:
        return (
            True,
            "Surface cues strongly resemble concrete or other impervious cover. "
            "A seedling recommendation cannot be generated for this scene.",
        )
    return False, ""


def _match_percent(penalty: float, max_p: float) -> int:
    return int(round(100.0 * _clamp01(1.0 - penalty / (max_p * 1.35))))


def _rationale(
    signals: dict[str, float],
    top: dict[str, Any],
    *,
    penro_label: str | None = None,
) -> str:
    veg = round(signals["vegetationIndex"] * 100)
    sun = round(signals["openSunIndex"] * 100)
    parts: list[str] = []
    if penro_label:
        parts.append(penro_label)
    parts.append(
        f"Aerial cues: vegetation ~{veg}%, open ground ~{sun}%.",
    )
    if "temperatureC" in signals or "humidityPct" in signals or "precipitationMm" in signals:
        temp = f"{signals.get('temperatureC', float('nan')):.0f}°C" if "temperatureC" in signals else "n/a"
        hum = f"{signals.get('humidityPct', float('nan')):.0f}%" if "humidityPct" in signals else "n/a"
        rain = f"{signals.get('precipitationMm', float('nan')):.1f}mm" if "precipitationMm" in signals else "n/a"
        parts.append(f"Weather now: temp {temp}, humidity {hum}, precip {rain}.")
    if "areaM2" in signals:
        parts.append(f"Assessed site area ~{signals['areaM2']:.0f} m².")

    parts.append(f"Top match on DENR contract list: {top['commonName']} — {top['notes']}")
    return " ".join(parts)


def _penro_context_label(penro_plot: dict[str, Any] | None) -> str:
    if not penro_plot:
        return "Select an NGP site to rank DENR PENRO contract species."
    site = penro_plot.get("site_code") or penro_plot.get("plot_code") or "NGP site"
    return f"NGP site {site} — species ranked from DENR PENRO contract list."


def recommend_from_bytes(
    image_bytes: bytes,
    latitude: float | None,
    longitude: float | None,
    *,
    area_m2: float | None = None,
    penro_plot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    img = Image.open(BytesIO(image_bytes))
    signals = compute_signals_from_image(img)

    if latitude is not None and longitude is not None:
        signals |= _fetch_weather_signals(latitude, longitude)
    signals |= _compute_area_signals(area_m2=area_m2)

    capture_validity = assess_capture_validity(signals)
    seedlings = build_seedlings_from_penro_plot(penro_plot) if penro_plot else []
    penro_label = _penro_context_label(penro_plot)
    penro_context = {
        "siteCode": (penro_plot or {}).get("site_code") or (penro_plot or {}).get("plot_code"),
        "source": "selected" if penro_plot else "none",
        "label": penro_label,
    }

    def _estimate() -> int | None:
        if not capture_validity.get("isValidFieldCapture", True):
            return None
        return estimate_seedlings_from_penro_plot(
            penro_plot,
            area_m2=signals.get("areaM2"),
        )

    unsuitable, unsuitable_reason = _unsuitable_for_planting(signals, capture_validity)
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
            "captureValidity": capture_validity,
            "penroContext": penro_context,
        }
        if latitude is not None and longitude is not None:
            out["signals"]["latitude"] = latitude
            out["signals"]["longitude"] = longitude
        out["estimatedSeedlingsNeeded"] = _estimate()
        return out

    if not seedlings:
        out = {
            "source": "remote",
            "unsuitableForPlanting": False,
            "unsuitableReason": None,
            "recommended": None,
            "alternatives": [],
            "rankedSeedlings": [],
            "confidence": 0.0,
            "rationale": penro_label,
            "signals": {**signals},
            "captureValidity": capture_validity,
            "penroContext": penro_context,
            "denrPlotRequired": True,
        }
        if latitude is not None and longitude is not None:
            out["signals"]["latitude"] = latitude
            out["signals"]["longitude"] = longitude
        out["estimatedSeedlingsNeeded"] = _estimate()
        return out

    penalties = [(s, _penalty(s, signals)) for s in seedlings]
    penalties.sort(key=lambda x: x[1])
    max_p = max((p for _, p in penalties), default=1e-6)
    ranked_seedlings = [
        {"seedling": _to_public(s), "matchPercent": _match_percent(p, max_p)}
        for s, p in penalties
    ]

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
        "rationale": _rationale(signals, best, penro_label=penro_label),
        "signals": {**signals},
        "captureValidity": capture_validity,
        "penroContext": penro_context,
    }
    if latitude is not None and longitude is not None:
        out["signals"]["latitude"] = latitude
        out["signals"]["longitude"] = longitude
    out["estimatedSeedlingsNeeded"] = _estimate()
    return out
