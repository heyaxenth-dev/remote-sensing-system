"""DENR PENRO NGP species list parsing and preference profiles (mirrors lib/penroSpeciesRecommendations.js)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

PROFILES_PATH = Path(__file__).resolve().parent.parent / "data" / "penro-species-profiles.json"

_CATEGORY_KEYWORDS: list[tuple[str, re.Pattern[str]]] = [
    ("bamboo", re.compile(r"kawayan|bamboo|buho", re.I)),
    ("understory", re.compile(r"coffee|cacao|abaca", re.I)),
    (
        "fruit",
        re.compile(
            r"mango|jackfruit|rambutan|guyabano|duhat|santol|cashew|lansones|avocado|atis|banana|papaya|calamansi|pili",
            re.I,
        ),
    ),
    ("pioneer_exotic", re.compile(r"mahogany|gmelina|ipil|kakawate|acacia|agoho|alibangbang", re.I)),
    (
        "native_timber",
        re.compile(r"narra|badlan|balod|toog|molave|antipolo|kamagong|lawaan|talisay|batwan|inyam|tapuyay", re.I),
    ),
]


def _normalize_token(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _load_profiles_data() -> dict[str, Any]:
    with PROFILES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def parse_species_planted(text: str | None) -> list[str]:
    if not text:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for part in re.split(r"[,;/]+", text):
        name = re.sub(r"^\*+", "", part.strip())
        name = re.sub(r"\s+", " ", name)
        if len(name) < 2:
            continue
        key = _normalize_token(name)
        if len(key) < 3 or key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def species_id_from_name(name: str) -> str:
    return _normalize_token(name) or "species"


def _infer_category(name: str) -> str:
    n = _normalize_token(name)
    for category, pattern in _CATEGORY_KEYWORDS:
        if pattern.search(name) or pattern.search(n):
            return category
    return "general"


def _profile_for_name(name: str, data: dict[str, Any]) -> dict[str, Any]:
    key = _normalize_token(name)
    explicit = (data.get("profiles") or {}).get(key) or {}
    category = explicit.get("category") or _infer_category(name)
    categories = data.get("categories") or {}
    cat = categories.get(category) or categories.get("general") or {}
    prefs = explicit.get("preferences") or cat.get("preferences") or {}
    notes_suffix = cat.get("notesSuffix") or (categories.get("general") or {}).get("notesSuffix", "")
    return {
        "scientificName": explicit.get("scientificName") or "",
        "category": category,
        "preferences": prefs,
        "notes": explicit.get("notes") or notes_suffix,
    }


def build_seedlings_from_penro_plot(plot: dict[str, Any]) -> list[dict[str, Any]]:
    text = plot.get("species_planted")
    if not text:
        return []
    data = _load_profiles_data()
    site = plot.get("site_code") or plot.get("plot_code") or "NGP site"
    survival_pct = None
    rate = plot.get("latest_survival_rate")
    if isinstance(rate, (int, float)):
        survival_pct = int(round(float(rate) * 100))
    seedlings: list[dict[str, Any]] = []
    for common_name in parse_species_planted(str(text)):
        profile = _profile_for_name(common_name, data)
        survival_note = (
            f" PENRO reported survival ~{survival_pct}% for this site." if survival_pct is not None else ""
        )
        seedlings.append(
            {
                "id": species_id_from_name(common_name),
                "commonName": common_name,
                "scientificName": profile["scientificName"],
                "notes": f"DENR NGP contract species ({site}). {profile['notes']}{survival_note}",
                "preferences": profile["preferences"],
                "penroContract": True,
            }
        )
    return seedlings


def estimate_seedlings_from_penro_plot(
    plot: dict[str, Any] | None,
    *,
    area_m2: float | None = None,
    plantable_area_sq_m: float | None = None,
) -> int:
    plantable = 250.0
    if plantable_area_sq_m is not None and plantable_area_sq_m > 0:
        plantable = float(plantable_area_sq_m)
    elif area_m2 is not None and area_m2 > 0:
        plantable = float(area_m2)

    if not plot:
        return max(1, int(__import__("math").ceil(plantable / 4.0)))

    try:
        area_ha = float(plot.get("area_ha") or 0)
        contracted = float(plot.get("seedlings_contracted") or plot.get("target_seedlings") or 0)
    except (TypeError, ValueError):
        area_ha = 0.0
        contracted = 0.0

    if area_ha > 0 and contracted > 0:
        site_m2 = area_ha * 10_000.0
        density = contracted / site_m2
        return max(1, int(round(density * plantable)))
    return max(1, int(__import__("math").ceil(plantable / 4.0)))
