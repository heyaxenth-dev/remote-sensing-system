"""Only accept outdoor land / aerial forest views — mirrors lib/captureValidity.js."""

from __future__ import annotations

REJECT_MESSAGES = {
    "keyboard_or_gadget": (
        "This looks like a keyboard, phone, or gadget — not an NGP land or aerial view. "
        "Point the camera at trees, soil, or open planting ground on site."
    ),
    "screen_or_display": (
        "This photo looks like a screen or indoor display — not the planting area. "
        "Face the camera at trees, open ground, or regrowth on site."
    ),
    "hardscape_concrete": (
        "Concrete, pavement, or asphalt detected — these are not plantable NGP areas. "
        "Capture soil, grass, or forest cover on site instead."
    ),
    "wood_or_boards": (
        "Wood, lumber, or board surfaces detected — not a plantable land or aerial view. "
        "Capture natural ground or vegetation on the NGP plot."
    ),
    "hardscape_built": (
        "Built or impervious surface detected (paths, structures, roofing). "
        "Only outdoor land and aerial forest views can be recorded."
    ),
    "not_land_or_aerial": (
        "Only outdoor land or aerial forest views are accepted. "
        "Retake facing the NGP plot (canopy, soil, or regrowth)."
    ),
    "non_field": (
        "This is not a valid field capture for NGP monitoring. "
        "Retake facing the plot canopy or open planting ground."
    ),
}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def has_land_or_aerial_vegetation_cue(signals: dict[str, float]) -> bool:
    veg = _clamp01(float(signals.get("vegetationIndex", 0.0)))
    green = _clamp01(float(signals.get("greenRatio", 0.0)))
    exg = _clamp01(float(signals.get("exgRatio", 0.0)))
    organic = _clamp01(float(signals.get("organicTextureIndex", 0.0)))
    if veg >= 0.18 or green >= 0.1:
        return True
    if exg >= 0.14 and (green >= 0.05 or organic >= 0.34):
        return True
    if organic >= 0.42 and (veg >= 0.12 or exg >= 0.1):
        return True
    return False


def _reject(capture_issue_type: str, non_field_likelihood: int = 65) -> dict:
    return {
        "isValidFieldCapture": False,
        "nonFieldLikelihood": non_field_likelihood,
        "captureIssueType": capture_issue_type,
        "reason": REJECT_MESSAGES.get(capture_issue_type, REJECT_MESSAGES["non_field"]),
    }


def _assess_non_field_device(signals: dict[str, float]) -> dict | None:
    veg = _clamp01(float(signals.get("vegetationIndex", 0.0)))
    green = _clamp01(float(signals.get("greenRatio", 0.0)))
    exg = _clamp01(float(signals.get("exgRatio", 0.0)))
    chroma = _clamp01(float(signals.get("surfaceChroma", 0.0)))
    lum_std = _clamp01(float(signals.get("luminanceStd", 0.0)))
    organic = _clamp01(float(signals.get("organicTextureIndex", 0.0)))
    concrete = _clamp01(float(signals.get("concreteLikelihood", 0.0)))
    open_sun = _clamp01(float(signals.get("openSunIndex", 0.0)))
    blue = _clamp01(float(signals.get("blueIndex", 0.33)))
    lum = _clamp01(float(signals.get("meanLuminance", 0.5)))
    edge = _clamp01(float(signals.get("edgeDensity", 0.0)))

    artificial_green = exg >= 0.16 and green < 0.22 and veg < 0.48
    digital_ui = (
        chroma >= 0.34
        and lum_std >= 0.24
        and edge >= 0.1
        and veg < 0.58
        and concrete < 0.6
    )
    screen_ui_signature = chroma >= 0.32 and lum_std >= 0.22 and edge >= 0.14 and veg < 0.55
    screen_glare = blue >= 0.34 and open_sun >= 0.45 and veg < 0.48 and chroma >= 0.26
    strong_blue_screen = blue >= 0.72 and edge >= 0.35 and veg < 0.52
    extreme_ui_edges = edge >= 0.45 and chroma >= 0.22 and veg < 0.55
    glossy_display = lum >= 0.48 and chroma >= 0.3 and lum_std >= 0.22 and veg < 0.45
    indoor_object = (
        open_sun >= 0.52
        and chroma >= 0.36
        and lum_std >= 0.26
        and veg < 0.4
        and green < 0.25
        and organic < 0.55
    )
    keyboard_or_gadget = (
        (veg < 0.2 and green < 0.12 and edge >= 0.28)
        or (chroma < 0.14 and edge >= 0.2 and veg < 0.25)
        or (concrete >= 0.48 and veg < 0.18 and green < 0.1 and edge >= 0.18)
    )

    score = _clamp01(
        (0.32 if artificial_green else 0.0)
        + (0.4 if digital_ui else 0.0)
        + (0.38 if screen_ui_signature else 0.0)
        + (0.36 if screen_glare else 0.0)
        + (0.45 if strong_blue_screen else 0.0)
        + (0.42 if extreme_ui_edges else 0.0)
        + (0.34 if glossy_display else 0.0)
        + (0.36 if indoor_object else 0.0)
        + (0.48 if keyboard_or_gadget else 0.0)
    )

    invalid = (
        keyboard_or_gadget
        or score >= 0.42
        or strong_blue_screen
        or extreme_ui_edges
        or screen_ui_signature
        or glossy_display
        or (digital_ui and (screen_glare or artificial_green or edge >= 0.16))
        or (screen_glare and (chroma >= 0.26 or edge >= 0.3))
        or indoor_object
    )

    if not invalid:
        return None
    if keyboard_or_gadget:
        return _reject("keyboard_or_gadget", 68)
    if screen_glare or glossy_display or screen_ui_signature or digital_ui:
        return _reject("screen_or_display", int(round(max(score, 0.58) * 100)))
    return _reject("non_field", int(round(max(score, 0.55) * 100)))


def _assess_unplantable_surfaces(signals: dict[str, float]) -> dict | None:
    veg = _clamp01(float(signals.get("vegetationIndex", 0.0)))
    green = _clamp01(float(signals.get("greenRatio", 0.0)))
    exg = _clamp01(float(signals.get("exgRatio", 0.0)))
    chroma = _clamp01(float(signals.get("surfaceChroma", 0.0)))
    lum_std = _clamp01(float(signals.get("luminanceStd", 0.0)))
    organic = _clamp01(float(signals.get("organicTextureIndex", 0.0)))
    concrete = _clamp01(float(signals.get("concreteLikelihood", 0.0)))
    open_sun = _clamp01(float(signals.get("openSunIndex", 0.0)))
    lum = _clamp01(float(signals.get("meanLuminance", 0.5)))
    edge = _clamp01(float(signals.get("edgeDensity", 0.0)))
    brown = _clamp01(float(signals.get("brownIndex", 0.0)))

    concrete_or_pavement = (
        (concrete >= 0.5 and veg < 0.22 and green < 0.12)
        or (concrete >= 0.58 and exg < 0.15)
        or (concrete >= 0.45 and organic < 0.3 and veg < 0.18 and green < 0.1)
    )
    gray_pavement = (
        concrete >= 0.42 and chroma < 0.22 and veg < 0.2 and green < 0.1 and lum_std < 0.45
    )
    wood_or_boards = (
        (brown >= 0.32 and veg < 0.22 and green < 0.12 and edge >= 0.1)
        or (brown >= 0.28 and chroma >= 0.08 and chroma <= 0.38 and veg < 0.18 and edge >= 0.14)
        or (brown >= 0.36 and concrete < 0.45 and green < 0.08)
    )
    construction_materials = (
        brown >= 0.24 and concrete >= 0.35 and veg < 0.2 and green < 0.1 and edge >= 0.16
    )
    metal_or_roofing = (
        lum >= 0.58
        and chroma < 0.24
        and veg < 0.16
        and green < 0.08
        and (concrete >= 0.35 or lum_std < 0.35)
    )
    painted_or_tarp = open_sun >= 0.5 and veg < 0.15 and green < 0.08 and (
        (chroma < 0.18 and concrete >= 0.38)
        or (chroma >= 0.4 and organic < 0.35 and edge < 0.12)
    )

    if concrete_or_pavement or gray_pavement:
        return _reject("hardscape_concrete", 78)
    if wood_or_boards:
        return _reject("wood_or_boards", 76)
    if construction_materials or metal_or_roofing or painted_or_tarp:
        return _reject("hardscape_built", 74)
    return None


def assess_capture_validity(signals: dict[str, float]) -> dict:
    unplantable = _assess_unplantable_surfaces(signals)
    if unplantable:
        return unplantable

    device = _assess_non_field_device(signals)
    if device:
        return device

    if not has_land_or_aerial_vegetation_cue(signals):
        return _reject("not_land_or_aerial", 72)

    return {
        "isValidFieldCapture": True,
        "nonFieldLikelihood": 0,
        "captureIssueType": None,
        "reason": None,
    }
