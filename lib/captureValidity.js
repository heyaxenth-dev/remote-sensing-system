/**
 * Only accept outdoor land / aerial forest views.
 * Rejects screens, gadgets, concrete, wood/boards, and other unplantable built surfaces.
 */

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

const REJECT_MESSAGES = {
  keyboard_or_gadget:
    "This looks like a keyboard, phone, or gadget — not an NGP land or aerial view. Point the camera at trees, soil, or open planting ground on site.",
  screen_or_display:
    "This photo looks like a screen or indoor display — not the planting area. Face the camera at trees, open ground, or regrowth on site.",
  hardscape_concrete:
    "Concrete, pavement, or asphalt detected — these are not plantable NGP areas. Capture soil, grass, or forest cover on site instead.",
  wood_or_boards:
    "Wood, lumber, or board surfaces detected — not a plantable land or aerial view. Capture natural ground or vegetation on the NGP plot.",
  hardscape_built:
    "Built or impervious surface detected (paths, structures, roofing). Only outdoor land and aerial forest views can be recorded.",
  not_land_or_aerial:
    "Only outdoor land or aerial forest views are accepted. Retake facing the NGP plot (canopy, soil, or regrowth).",
  non_field:
    "This is not a valid field capture for NGP monitoring. Retake facing the plot canopy or open planting ground.",
};

/** Minimum vegetation / land cues required to record a capture. */
export function hasLandOrAerialVegetationCue(signals = {}) {
  const veg = clamp01(signals.vegetationIndex ?? 0);
  const green = clamp01(signals.greenRatio ?? 0);
  const exg = clamp01(signals.exgRatio ?? 0);
  const organic = clamp01(signals.organicTextureIndex ?? 0);

  if (veg >= 0.18 || green >= 0.1) return true;
  if (exg >= 0.14 && (green >= 0.05 || organic >= 0.34)) return true;
  if (organic >= 0.42 && (veg >= 0.12 || exg >= 0.1)) return true;
  return false;
}

function reject(captureIssueType, nonFieldLikelihood = 65) {
  return {
    isValidFieldCapture: false,
    nonFieldLikelihood,
    captureIssueType,
    reason: REJECT_MESSAGES[captureIssueType] || REJECT_MESSAGES.non_field,
  };
}

function assessNonFieldDevice(signals) {
  const veg = clamp01(signals.vegetationIndex ?? 0);
  const green = clamp01(signals.greenRatio ?? 0);
  const exg = clamp01(signals.exgRatio ?? 0);
  const chroma = clamp01(signals.surfaceChroma ?? 0);
  const lumStd = clamp01(signals.luminanceStd ?? 0);
  const organic = clamp01(signals.organicTextureIndex ?? 0);
  const concrete = clamp01(signals.concreteLikelihood ?? 0);
  const openSun = clamp01(signals.openSunIndex ?? 0);
  const blue = clamp01(signals.blueIndex ?? 0.33);
  const lum = clamp01(signals.meanLuminance ?? 0.5);
  const edge = clamp01(signals.edgeDensity ?? 0);

  const artificialGreen = exg >= 0.16 && green < 0.22 && veg < 0.48;
  const digitalUi =
    chroma >= 0.34 &&
    lumStd >= 0.24 &&
    edge >= 0.1 &&
    veg < 0.58 &&
    concrete < 0.6;
  const screenUiSignature =
    chroma >= 0.32 && lumStd >= 0.22 && edge >= 0.14 && veg < 0.55;
  const screenGlare =
    blue >= 0.34 && openSun >= 0.45 && veg < 0.48 && chroma >= 0.26;
  const strongBlueScreen = blue >= 0.72 && edge >= 0.35 && veg < 0.52;
  const extremeUiEdges = edge >= 0.45 && chroma >= 0.22 && veg < 0.55;
  const glossyDisplay =
    lum >= 0.48 && chroma >= 0.3 && lumStd >= 0.22 && veg < 0.45;
  const indoorObject =
    openSun >= 0.52 &&
    chroma >= 0.36 &&
    lumStd >= 0.26 &&
    veg < 0.4 &&
    green < 0.25 &&
    organic < 0.55;
  const keyboardOrGadget =
    (veg < 0.2 && green < 0.12 && edge >= 0.28) ||
    (chroma < 0.14 && edge >= 0.2 && veg < 0.25) ||
    (concrete >= 0.48 && veg < 0.18 && green < 0.1 && edge >= 0.18);

  const score = clamp01(
    (artificialGreen ? 0.32 : 0) +
      (digitalUi ? 0.4 : 0) +
      (screenUiSignature ? 0.38 : 0) +
      (screenGlare ? 0.36 : 0) +
      (strongBlueScreen ? 0.45 : 0) +
      (extremeUiEdges ? 0.42 : 0) +
      (glossyDisplay ? 0.34 : 0) +
      (indoorObject ? 0.36 : 0) +
      (keyboardOrGadget ? 0.48 : 0),
  );

  const invalid =
    keyboardOrGadget ||
    score >= 0.42 ||
    strongBlueScreen ||
    extremeUiEdges ||
    screenUiSignature ||
    glossyDisplay ||
    (digitalUi && (screenGlare || artificialGreen || edge >= 0.16)) ||
    (screenGlare && (chroma >= 0.26 || edge >= 0.3)) ||
    indoorObject;

  if (!invalid) return null;

  if (keyboardOrGadget) return reject("keyboard_or_gadget", 68);
  if (screenGlare || glossyDisplay || screenUiSignature || digitalUi) {
    return reject("screen_or_display", Math.round(Math.max(score, 0.58) * 100));
  }
  return reject("non_field", Math.round(Math.max(score, 0.55) * 100));
}

/** Concrete, asphalt, wood/boards, metal roofing, and other impervious or built cover. */
function assessUnplantableSurfaces(signals) {
  const veg = clamp01(signals.vegetationIndex ?? 0);
  const green = clamp01(signals.greenRatio ?? 0);
  const exg = clamp01(signals.exgRatio ?? 0);
  const chroma = clamp01(signals.surfaceChroma ?? 0);
  const lumStd = clamp01(signals.luminanceStd ?? 0);
  const organic = clamp01(signals.organicTextureIndex ?? 0);
  const concrete = clamp01(signals.concreteLikelihood ?? 0);
  const openSun = clamp01(signals.openSunIndex ?? 0);
  const lum = clamp01(signals.meanLuminance ?? 0.5);
  const edge = clamp01(signals.edgeDensity ?? 0);
  const brown = clamp01(signals.brownIndex ?? 0);

  // Concrete / asphalt / paved paths (strong hardscape cue, little vegetation)
  const concreteOrPavement =
    (concrete >= 0.5 && veg < 0.22 && green < 0.12) ||
    (concrete >= 0.58 && exg < 0.15) ||
    (concrete >= 0.45 && organic < 0.3 && veg < 0.18 && green < 0.1);

  // Uniform gray pavement (low chroma hardscape)
  const grayPavement =
    concrete >= 0.42 &&
    chroma < 0.22 &&
    veg < 0.2 &&
    green < 0.1 &&
    lumStd < 0.45;

  // Lumber, plywood, planks — warm brown, plank edges, almost no green
  const woodOrBoards =
    (brown >= 0.32 && veg < 0.22 && green < 0.12 && edge >= 0.1) ||
    (brown >= 0.28 && chroma >= 0.08 && chroma <= 0.38 && veg < 0.18 && edge >= 0.14) ||
    (brown >= 0.36 && concrete < 0.45 && green < 0.08);

  // Stacked materials / construction (brown + gray, high edge, no canopy)
  const constructionMaterials =
    brown >= 0.24 &&
    concrete >= 0.35 &&
    veg < 0.2 &&
    green < 0.1 &&
    edge >= 0.16;

  // Metal / corrugated / light roofing — bright, low chroma, no vegetation
  const metalOrRoofing =
    lum >= 0.58 &&
    chroma < 0.24 &&
    veg < 0.16 &&
    green < 0.08 &&
    (concrete >= 0.35 || lumStd < 0.35);

  // Painted walls / tarps — flat, saturated or very dull, no plants
  const paintedOrTarp =
    openSun >= 0.5 &&
    veg < 0.15 &&
    green < 0.08 &&
    ((chroma < 0.18 && concrete >= 0.38) ||
      (chroma >= 0.4 && organic < 0.35 && edge < 0.12));

  if (concreteOrPavement || grayPavement) {
    return reject("hardscape_concrete", 78);
  }
  if (woodOrBoards) {
    return reject("wood_or_boards", 76);
  }
  if (constructionMaterials || metalOrRoofing || paintedOrTarp) {
    return reject("hardscape_built", 74);
  }

  return null;
}

/**
 * @param {Record<string, number>} signals from computeSignalsFromRgba
 */
export function assessCaptureValidity(signals = {}) {
  const unplantable = assessUnplantableSurfaces(signals);
  if (unplantable) return unplantable;

  const device = assessNonFieldDevice(signals);
  if (device) return device;

  if (!hasLandOrAerialVegetationCue(signals)) {
    return reject("not_land_or_aerial", 72);
  }

  return {
    isValidFieldCapture: true,
    nonFieldLikelihood: 0,
    captureIssueType: null,
    reason: null,
  };
}

/** @param {object} recommendation */
export function isRejectedFieldCapture(recommendation) {
  if (!recommendation) return false;
  if (recommendation.captureValidity?.isValidFieldCapture === false) return true;
  if (recommendation.forestArea?.surfaceType === "non_field") return true;
  if (recommendation.forestArea?.surfaceType === "hardscape") return true;
  if (
    recommendation.unsuitableForPlanting &&
    recommendation.captureValidity?.captureIssueType
  ) {
    return true;
  }
  return false;
}
