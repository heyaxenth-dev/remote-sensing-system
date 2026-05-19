import jpeg from "jpeg-js";
import { assessCaptureValidity } from "./captureValidity";
import { assessForestAreaFromSignals } from "./forestAreaAssessment";
import {
  buildSeedlingsFromPenroPlot,
  estimateSeedlingsFromPenroPlot,
} from "./penroSpeciesRecommendations";

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

const DEFAULT_CAPTURE_AREA_M2 = 250;
const SEEDLING_SPACING_M2 = 4;

/** Stocking estimate — PENRO contracted density when plot is known, else spacing heuristic. */
export function estimatedSeedlingsFromSignals(signals, plot, forestArea) {
  if (plot) {
    return estimateSeedlingsFromPenroPlot(plot, {
      areaM2: signals?.areaM2,
      plantableAreaSqM: forestArea?.plantableAreaSqM,
    });
  }
  if (!signals || typeof signals !== "object") {
    return Math.max(1, Math.ceil(DEFAULT_CAPTURE_AREA_M2 / SEEDLING_SPACING_M2));
  }
  const raw = signals.areaM2;
  const area =
    typeof raw === "number" && !Number.isNaN(raw) ? raw : DEFAULT_CAPTURE_AREA_M2;
  return Math.max(1, Math.ceil(area / SEEDLING_SPACING_M2));
}

function norm01(x, lo, hi) {
  if (hi <= lo) return 0;
  return clamp01((x - lo) / (hi - lo));
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Heuristic surface cues including concrete / hardscape likelihood (mirrors analysis/recommend.py).
 */
export function computeSignalsFromRgba(rgba, width, height) {
  const stride = Math.max(4, Math.round(Math.min(width, height) / 48));
  let total = 0;
  let greenish = 0;
  let exgHits = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLum = 0;
  let sumLum2 = 0;
  let sumChroma = 0;
  let edgeHits = 0;
  let edgeSamples = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) << 2;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      total += 1;
      sumR += r;
      sumG += g;
      sumB += b;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      sumLum += lum;
      sumLum2 += lum * lum;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      sumChroma += (mx - mn) / 255;
      if (g > r + 12 && g > b + 12) greenish += 1;
      const exg = 2 * g - r - b;
      if (exg > 20) exgHits += 1;

      if (x + stride < width) {
        const j = i + (stride << 2);
        const dr = Math.abs(r - rgba[j]);
        const dg = Math.abs(g - rgba[j + 1]);
        const db = Math.abs(b - rgba[j + 2]);
        edgeSamples += 1;
        if (dr + dg + db > 48) edgeHits += 1;
      }
      if (y + stride < height) {
        const j = ((y + stride) * width + x) << 2;
        const dr = Math.abs(r - rgba[j]);
        const dg = Math.abs(g - rgba[j + 1]);
        const db = Math.abs(b - rgba[j + 2]);
        edgeSamples += 1;
        if (dr + dg + db > 48) edgeHits += 1;
      }
    }
  }

  if (!total) {
    return {
      vegetationIndex: 0,
      openSunIndex: 0.5,
      moistureHint: 0.5,
      greenRatio: 0,
      meanLuminance: 0.5,
      concreteLikelihood: 0.5,
      surfaceChroma: 0.5,
      luminanceStd: 0.2,
      organicTextureIndex: 0,
      edgeDensity: 0,
      brownIndex: 0,
    };
  }

  const greenRatio = greenish / total;
  const exgRatio = exgHits / total;
  const meanR = sumR / total;
  const meanG = sumG / total;
  const meanB = sumB / total;
  const meanLum = sumLum / total;
  const varLum = Math.max(0, sumLum2 / total - meanLum * meanLum);
  const lumStd = Math.sqrt(varLum);
  const meanChroma = sumChroma / total;
  const denom = Math.max(1, meanR + meanG + meanB);
  const openSunIndex = clamp01(meanLum * 0.65 + (1 - greenRatio) * 0.35);
  const moistureHint = clamp01(
    (meanB / denom) * 3 * 0.42 + greenRatio * 0.33 + meanLum * 0.25,
  );

  const uniformity = clamp01(1 - Math.min(1, lumStd * 4));
  const grayBand = clamp01(1 - Math.abs(meanLum - 0.48) / 0.38);
  // Heterogeneous color + luminance variation → natural canopy / soil / litter, not flat pavement.
  const organicTextureIndex = clamp01(
    meanChroma * 0.52 + Math.min(1, lumStd * 3.4) * 0.48,
  );
  const baseConcrete = clamp01(
    (1 - greenRatio) * 0.38 +
      (1 - meanChroma) * 0.32 +
      uniformity * 0.22 +
      grayBand * 0.18,
  );
  const concreteLikelihood = clamp01(
    baseConcrete * (1 - 0.74 * organicTextureIndex),
  );

  const vegetationIndex = clamp01(Math.max(greenRatio, exgRatio * 0.92));
  const blueIndex = clamp01((meanB / denom) * 3);
  const brownIndex = clamp01((meanR - (meanG + meanB) / 2) / 128);
  const edgeDensity =
    edgeSamples > 0 ? clamp01(edgeHits / edgeSamples) : 0;

  return {
    vegetationIndex,
    openSunIndex,
    moistureHint,
    greenRatio: clamp01(greenRatio),
    exgRatio: clamp01(exgRatio),
    meanLuminance: clamp01(meanLum),
    blueIndex,
    brownIndex,
    concreteLikelihood,
    surfaceChroma: clamp01(meanChroma),
    luminanceStd: Math.min(1, lumStd * 2.5),
    organicTextureIndex,
    edgeDensity,
  };
}

function environmentProfile(seedling) {
  const sid = (seedling.id || "").trim().toLowerCase();
  const base = {
    humidityIndex: { ideal: 0.55, weight: 0.25 },
    rainIndex: { ideal: 0.45, weight: 0.25 },
    heatIndex: { ideal: 0.6, weight: 0.2 },
    windIndex: { ideal: 0.45, weight: 0.1 },
    areaIndex: { ideal: 0.55, weight: 0.2 },
  };
  if (/kawayan|bamboo|buho/.test(sid)) {
    return {
      ...base,
      humidityIndex: { ideal: 0.8, weight: 0.65 },
      rainIndex: { ideal: 0.75, weight: 0.7 },
      areaIndex: { ideal: 0.75, weight: 0.25 },
    };
  }
  if (/badlan|balod|molave|toog|narra/.test(sid)) {
    return {
      ...base,
      humidityIndex: { ideal: 0.45, weight: 0.5 },
      rainIndex: { ideal: 0.3, weight: 0.55 },
      heatIndex: { ideal: 0.65, weight: 0.3 },
    };
  }
  if (/mango|jackfruit|rambutan|guyabano|duhat|fruit/.test(sid)) {
    return {
      ...base,
      humidityIndex: { ideal: 0.5, weight: 0.4 },
      rainIndex: { ideal: 0.4, weight: 0.45 },
      heatIndex: { ideal: 0.68, weight: 0.3 },
      areaIndex: { ideal: 0.4, weight: 0.2 },
    };
  }
  return base;
}

function mergeAreaIntoSignals(areaM2) {
  if (typeof areaM2 !== "number" || !Number.isFinite(areaM2)) return {};
  return {
    areaIndex: norm01(areaM2, 50, 20_000),
    areaM2,
  };
}

function penaltyForSeedling(seedling, signals) {
  let penalty = 0;
  const prefs = seedling.preferences || {};
  for (const key of Object.keys(prefs)) {
    const spec = prefs[key];
    const v = signals[key];
    if (v === undefined || spec?.ideal === undefined) continue;
    const w = typeof spec.weight === "number" ? spec.weight : 1;
    const d = v - spec.ideal;
    penalty += w * d * d;
  }
  const env = environmentProfile(seedling);
  for (const key of Object.keys(env)) {
    const spec = env[key];
    const v = signals[key];
    if (v === undefined || spec?.ideal === undefined) continue;
    const w = typeof spec.weight === "number" ? spec.weight : 1;
    const d = v - spec.ideal;
    penalty += w * d * d;
  }
  return penalty;
}

function unsuitableForPlanting(signals, forestArea, captureValidity) {
  if (captureValidity && captureValidity.isValidFieldCapture === false) {
    return { unsuitable: true, reason: captureValidity.reason };
  }
  if (forestArea?.surfaceType === "non_field") {
    return {
      unsuitable: true,
      reason: forestArea.summary || captureValidity?.reason,
    };
  }
  if (forestArea?.surfaceType === "hardscape" || forestArea?.isPlantable === false) {
    if (forestArea?.surfaceType === "forest_canopy") {
      return {
        unsuitable: true,
        reason:
          forestArea.summary ||
          "Closed forest canopy in aerial view — monitor existing trees; open-field seedling stocking is not the primary action.",
      };
    }
    return {
      unsuitable: true,
      reason:
        forestArea?.summary ||
        "Surface not suitable for new seedling planting based on aerial/forest-area assessment.",
    };
  }
  const veg = signals.vegetationIndex ?? 0;
  const conc = signals.concreteLikelihood ?? 0;
  const org = signals.organicTextureIndex ?? 0;
  if (conc >= 0.68 && veg < 0.12 && org < 0.26) {
    return {
      unsuitable: true,
      reason:
        "This capture looks like hardscape (concrete/asphalt): very low vegetation and flat, low-color cues. Not a plantable forest area.",
    };
  }
  return { unsuitable: false, reason: "" };
}

function matchPercent(penalty, maxP) {
  return Math.round(100 * clamp01(1 - penalty / (maxP * 1.35)));
}

function buildRationale(signals, top, forestArea, penroContext) {
  const veg = (signals.vegetationIndex * 100).toFixed(0);
  const sun = (signals.openSunIndex * 100).toFixed(0);
  const parts = [];
  if (penroContext?.label) {
    parts.push(penroContext.label);
  }
  parts.push(`Aerial cues: vegetation ~${veg}%, open ground ~${sun}%.`);
  if (forestArea) {
    parts.push(
      `Plantable area score ${forestArea.plantabilityScore}% · canopy ${forestArea.forestCanopyPct}% · health index ${forestArea.healthIndex}%.`,
    );
    if (forestArea.plantableAreaSqM > 0) {
      parts.push(`Estimated plantable footprint ~${forestArea.plantableAreaSqM} m².`);
    }
  } else if (signals.areaM2 != null) {
    parts.push(`Assessed site area ~${signals.areaM2.toFixed(0)} m².`);
  }
  if (
    signals.temperatureC != null ||
    signals.humidityPct != null ||
    signals.precipitationMm != null
  ) {
    const temp =
      signals.temperatureC != null ? `${signals.temperatureC.toFixed(0)}°C` : "n/a";
    const hum =
      signals.humidityPct != null ? `${signals.humidityPct.toFixed(0)}%` : "n/a";
    const rain =
      signals.precipitationMm != null ? `${signals.precipitationMm.toFixed(1)}mm` : "n/a";
    parts.push(`Weather: ${temp}, ${hum} humidity, ${rain} precip.`);
  }
  parts.push(`Top match on DENR contract list: ${top.commonName} — ${top.notes}`);
  return parts.join(" ");
}

function toPublicSeedling(s) {
  return {
    id: s.id,
    commonName: s.commonName,
    scientificName: s.scientificName,
    notes: s.notes,
  };
}

/**
 * @param {Record<string, number>} signals
 * @param {{ seedlings?: object[], penroContext?: object, plot?: object }} [options]
 */
export function rankSeedlingsFromSignals(signals, options = {}) {
  const { seedlings = [], penroContext = null, plot = null } = options;
  const captureValidity = assessCaptureValidity(signals);
  const forestArea = assessForestAreaFromSignals(signals);
  const u = unsuitableForPlanting(signals, forestArea, captureValidity);
  const estimate = () =>
    estimatedSeedlingsFromSignals(signals, plot, forestArea);

  if (u.unsuitable) {
    return {
      recommended: null,
      alternatives: [],
      rankedSeedlings: [],
      confidence: 0,
      rationale: u.reason,
      signals,
      forestArea,
      captureValidity,
      penroContext,
      unsuitableForPlanting: true,
      unsuitableReason: u.reason,
      estimatedSeedlingsNeeded: null,
    };
  }

  if (!seedlings.length) {
    const rationale =
      penroContext?.label ||
      "Select an NGP site (DENR PENRO) to rank species from that site's contract list.";
    return {
      recommended: null,
      alternatives: [],
      rankedSeedlings: [],
      confidence: 0,
      rationale,
      signals,
      forestArea,
      captureValidity,
      penroContext,
      denrPlotRequired: true,
      unsuitableForPlanting: false,
      unsuitableReason: null,
      estimatedSeedlingsNeeded: estimate(),
    };
  }

  const items = seedlings.map((s) => ({
    seedling: s,
    penalty: penaltyForSeedling(s, signals),
  }));
  items.sort((a, b) => a.penalty - b.penalty);
  const maxP = Math.max(...items.map((x) => x.penalty), 1e-6);

  const rankedSeedlings = items.map((x) => ({
    seedling: toPublicSeedling(x.seedling),
    matchPercent: matchPercent(x.penalty, maxP),
  }));

  const best = items[0];
  const confidence = clamp01(1 - best.penalty / (maxP * 1.35));

  return {
    recommended: toPublicSeedling(best.seedling),
    alternatives: items.slice(1, 4).map((x) => toPublicSeedling(x.seedling)),
    rankedSeedlings,
    confidence,
    rationale: buildRationale(signals, best.seedling, forestArea, penroContext),
    signals,
    forestArea,
    captureValidity,
    penroContext,
    unsuitableForPlanting: false,
    unsuitableReason: null,
    estimatedSeedlingsNeeded: estimate(),
  };
}

/**
 * @param {{
 *   base64: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 *   area_m2?: number | null,
 *   weatherSignals?: Record<string, number>,
 *   plot?: object | null,
 *   nearestMeta?: { distanceMeters?: number } | null,
 * }} input
 */
export function analyzeSeedlingLocally(input) {
  const bytes = base64ToUint8Array(input.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  if (!decoded?.data || !decoded.width || !decoded.height) {
    throw new Error("Could not decode capture for analysis");
  }
  let signals = computeSignalsFromRgba(
    decoded.data,
    decoded.width,
    decoded.height,
  );

  const ws = input.weatherSignals && typeof input.weatherSignals === "object"
    ? input.weatherSignals
    : {};
  signals = { ...signals, ...ws };

  const areaMerged = mergeAreaIntoSignals(input.area_m2);
  signals = { ...signals, ...areaMerged };

  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    signals = {
      ...signals,
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  const plot = input.plot ?? null;
  const seedlings = plot ? buildSeedlingsFromPenroPlot(plot) : [];
  const penroContext =
    input.penroContext ??
    (plot
      ? {
          plot,
          siteCode: plot.site_code || plot.plot_code,
          source: input.nearestMeta ? "gps_nearest" : "selected",
          label: input.nearestMeta
            ? `Nearest NGP site ${plot.site_code || plot.plot_code} (~${input.nearestMeta.distanceMeters} m) — DENR contract species.`
            : `NGP site ${plot.site_code || plot.plot_code} — species ranked from DENR PENRO contract list.`,
        }
      : {
          plot: null,
          source: "none",
          label: "Select an NGP site to rank DENR PENRO contract species.",
        });

  const ranked = rankSeedlingsFromSignals(signals, {
    seedlings,
    penroContext,
    plot,
  });
  const estimatedSeedlingsNeeded =
    ranked.estimatedSeedlingsNeeded ??
    estimatedSeedlingsFromSignals(ranked.signals ?? signals, plot, ranked.forestArea);
  return { source: "local", ...ranked, estimatedSeedlingsNeeded };
}
