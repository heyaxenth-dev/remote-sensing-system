/**
 * Aerial / in-situ forest-area assessment from scene color cues (canopy, open ground, hardscape).
 * Used to decide plantability and to feed survival & health monitoring dashboards.
 */

import {
  assessCaptureValidity,
  hasLandOrAerialVegetationCue,
} from "./captureValidity";

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * @param {Record<string, number>} signals from computeSignalsFromRgba / analysis API
 */
export function assessForestAreaFromSignals(signals = {}) {
  const captureValidity = assessCaptureValidity(signals);
  if (!captureValidity.isValidFieldCapture) {
    return {
      isPlantable: false,
      plantabilityScore: Math.max(5, 100 - captureValidity.nonFieldLikelihood),
      forestCanopyPct: 0,
      openGroundPct: 0,
      hardscapePct: 0,
      healthIndex: 0,
      surfaceType: "non_field",
      plantableAreaSqM: 0,
      assessedAreaSqM:
        typeof signals.areaM2 === "number" && signals.areaM2 > 0 ? signals.areaM2 : 250,
      summary: captureValidity.reason,
      aerialViewNote:
        "Rejected — retake facing natural ground, canopy, or regrowth (not concrete, wood, screens, or gadgets).",
      monitoringFocus: "site_condition_audit",
      captureValidity,
    };
  }

  const veg = clamp01(signals.vegetationIndex ?? signals.greenRatio ?? 0);
  const exg = clamp01(signals.exgRatio ?? 0);
  const canopy = clamp01(Math.max(veg, exg * 0.95));
  const concrete = clamp01(signals.concreteLikelihood ?? 0);
  const organic = clamp01(signals.organicTextureIndex ?? 0);
  const openSun = clamp01(signals.openSunIndex ?? 0);
  const lumStd = clamp01(signals.luminanceStd ?? 0.2);

  const forestCanopyPct = Math.round(canopy * 100);
  const openGroundPct = Math.round(clamp01(openSun * (1 - canopy * 0.65)) * 100);
  const hardscapePct = Math.round(concrete * 100);

  // Vegetation health proxy: organic texture + canopy with variation (not flat pavement)
  const healthIndex = Math.round(
    clamp01(organic * 0.45 + canopy * 0.35 + lumStd * 0.2) * 100,
  );

  let surfaceType = "mixed";
  let isPlantable = false;
  let plantabilityScore = 50;
  let summary = "";
  let aerialViewNote = "";

  if (concrete >= 0.68 && canopy < 0.14 && organic < 0.28) {
    surfaceType = "hardscape";
    isPlantable = false;
    plantabilityScore = Math.round(5 + (1 - concrete) * 10);
    summary =
      "Aerial view: impervious surface (concrete/asphalt). Not suitable for seedling establishment.";
    aerialViewNote = "Dominated by built or paved cover — reforestation planting not advised here.";
  } else if (canopy >= 0.55 && organic >= 0.35) {
    surfaceType = "forest_canopy";
    isPlantable = false;
    plantabilityScore = Math.round(25 + (1 - canopy) * 35);
    summary =
      "Aerial view: closed forest canopy. Monitor survival/health of existing stock; new bare-root planting is usually not the primary action.";
    aerialViewNote =
      "Dense vegetation cover — treat as established forest area for monitoring, not open planting.";
  } else if (canopy >= 0.28 && canopy < 0.55 && organic >= 0.3) {
    surfaceType = "partial_canopy";
    isPlantable = true;
    plantabilityScore = Math.round(55 + (1 - concrete) * 25);
    summary =
      "Aerial view: partial canopy / mixed cover. Generally plantable for gap planting and survival monitoring.";
    aerialViewNote = "Mixed forest and open patches — suitable for gap planting and survival monitoring.";
  } else if (
    canopy < 0.22 &&
    openSun >= 0.45 &&
    concrete < 0.45 &&
    hasLandOrAerialVegetationCue(signals)
  ) {
    surfaceType = "open_plantable";
    isPlantable = true;
    plantabilityScore = Math.round(72 + (1 - concrete) * 22);
    summary =
      "Aerial view: open ground with low canopy obstruction. Suitable for new seedling establishment.";
    aerialViewNote = "Open plantable area — prioritize stocking and survival follow-up.";
  } else if (canopy < 0.35 && concrete < 0.5 && hasLandOrAerialVegetationCue(signals)) {
    surfaceType = "sparse_vegetation";
    isPlantable = true;
    plantabilityScore = Math.round(60 + organic * 25);
    summary =
      "Aerial view: sparse vegetation / early regrowth. Plantable; monitor health trends after outplanting.";
    aerialViewNote = "Degraded or young cover — good candidate for reforestation monitoring.";
  } else {
    surfaceType = "mixed";
    isPlantable =
      concrete < 0.55 && canopy < 0.62 && hasLandOrAerialVegetationCue(signals);
    plantabilityScore = Math.round(40 + organic * 30 + (isPlantable ? 15 : 0));
    summary = isPlantable
      ? "Aerial view: mixed surface cues. Likely plantable with field verification."
      : "Aerial view: mixed cues — verify on ground before planting.";
    aerialViewNote = "Review canopy cover and site access on foot before confirming planting.";
  }

  const areaM2 =
    typeof signals.areaM2 === "number" && signals.areaM2 > 0
      ? signals.areaM2
      : 250;
  if (isPlantable && !hasLandOrAerialVegetationCue(signals)) {
    isPlantable = false;
    surfaceType = "non_field";
    plantabilityScore = Math.min(plantabilityScore, 15);
    summary =
      "No land or aerial vegetation cues — only outdoor NGP plot views can be recorded.";
    aerialViewNote = "Retake facing trees, open ground, or regrowth on site.";
  }

  const plantableAreaSqM = isPlantable
    ? Math.round(areaM2 * clamp01(plantabilityScore / 100))
    : 0;

  return {
    isPlantable,
    plantabilityScore,
    forestCanopyPct,
    openGroundPct,
    hardscapePct,
    healthIndex,
    surfaceType,
    plantableAreaSqM,
    assessedAreaSqM: areaM2,
    summary,
    aerialViewNote,
    monitoringFocus: isPlantable
      ? "survival_and_stocking"
      : surfaceType === "forest_canopy"
        ? "canopy_health_trends"
        : "site_condition_audit",
  };
}
