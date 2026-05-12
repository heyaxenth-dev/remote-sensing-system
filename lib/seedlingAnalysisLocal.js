import jpeg from "jpeg-js";
import catalog from "../data/seedling-catalog.json";

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

const DEFAULT_CAPTURE_AREA_M2 = 250;
const SEEDLING_SPACING_M2 = 4;

/** Mirrors analysis/recommend.py — stocking estimate from assessed area (default plot when unknown). */
export function estimatedSeedlingsFromSignals(signals) {
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
      // Excess green (ExG): picks up shaded foliage / canopy where strict g>r,b fails.
      const exg = 2 * g - r - b;
      if (exg > 20) exgHits += 1;
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

  return {
    vegetationIndex,
    openSunIndex,
    moistureHint,
    greenRatio: clamp01(greenRatio),
    exgRatio: clamp01(exgRatio),
    meanLuminance: clamp01(meanLum),
    concreteLikelihood,
    surfaceChroma: clamp01(meanChroma),
    luminanceStd: Math.min(1, lumStd * 2.5),
    organicTextureIndex,
  };
}

function environmentProfile(seedling) {
  const sid = (seedling.id || "").trim().toLowerCase();
  const base = {
    humidityIndex: { ideal: 0.55, weight: 0.25 },
    rainIndex: { ideal: 0.45, weight: 0.25 },
    heatIndex: { ideal: 0.6, weight: 0.2 },
    windIndex: { ideal: 0.45, weight: 0.1 },
    areaIndex: { ideal: 0.55, weight: 0.15 },
    drainageIndex: { ideal: 0.6, weight: 0.25 },
    soilPhFit: { ideal: 0.85, weight: 0.2 },
    textureIndex: { ideal: 0.55, weight: 0.1 },
  };
  if (sid === "bamboo") {
    return {
      ...base,
      humidityIndex: { ideal: 0.8, weight: 0.65 },
      rainIndex: { ideal: 0.75, weight: 0.7 },
      drainageIndex: { ideal: 0.45, weight: 0.35 },
      areaIndex: { ideal: 0.75, weight: 0.25 },
    };
  }
  if (sid === "moringa") {
    return {
      ...base,
      humidityIndex: { ideal: 0.45, weight: 0.45 },
      rainIndex: { ideal: 0.25, weight: 0.55 },
      drainageIndex: { ideal: 0.8, weight: 0.55 },
      heatIndex: { ideal: 0.7, weight: 0.35 },
      areaIndex: { ideal: 0.35, weight: 0.2 },
    };
  }
  if (sid === "molave") {
    return {
      ...base,
      humidityIndex: { ideal: 0.4, weight: 0.55 },
      rainIndex: { ideal: 0.2, weight: 0.65 },
      drainageIndex: { ideal: 0.85, weight: 0.6 },
      heatIndex: { ideal: 0.7, weight: 0.35 },
    };
  }
  if (sid === "narra") {
    return {
      ...base,
      humidityIndex: { ideal: 0.6, weight: 0.35 },
      rainIndex: { ideal: 0.45, weight: 0.35 },
      drainageIndex: { ideal: 0.65, weight: 0.35 },
      areaIndex: { ideal: 0.6, weight: 0.2 },
    };
  }
  return base;
}

function mergeSoilIntoSignals(soil) {
  if (!soil || typeof soil !== "object") return {};
  const out = {};
  if (typeof soil.ph === "number" && Number.isFinite(soil.ph)) {
    out.soilPh = soil.ph;
    out.soilPhFit = clamp01(1 - Math.abs(soil.ph - 6.5) / 2.5);
  }
  const drainageMap = { poor: 0.15, medium: 0.55, good: 0.85 };
  if (typeof soil.drainage === "string") {
    const v = drainageMap[soil.drainage.trim().toLowerCase()];
    if (v != null) out.drainageIndex = v;
  }
  const textureMap = { sandy: 0.25, loam: 0.6, clay: 0.8 };
  if (typeof soil.texture === "string") {
    const v = textureMap[soil.texture.trim().toLowerCase()];
    if (v != null) out.textureIndex = v;
  }
  return out;
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

function unsuitableForPlanting(signals) {
  const veg = signals.vegetationIndex ?? 0;
  const conc = signals.concreteLikelihood ?? 0;
  const org = signals.organicTextureIndex ?? 0;
  // Require both high “concrete” score and low natural texture so wooded / canopy shots are not rejected.
  if (conc >= 0.68 && veg < 0.12 && org < 0.26) {
    return {
      unsuitable: true,
      reason:
        "This capture looks like hardscape (concrete/asphalt): very low vegetation and flat, low-color cues. Seedlings need soil—not paved surfaces.",
    };
  }
  if (conc >= 0.78 && org < 0.24 && veg < 0.16) {
    return {
      unsuitable: true,
      reason:
        "Surface cues strongly resemble concrete or other impervious cover. A seedling recommendation cannot be generated for this scene.",
    };
  }
  return { unsuitable: false, reason: "" };
}

function matchPercent(penalty, maxP) {
  return Math.round(100 * clamp01(1 - penalty / (maxP * 1.35)));
}

function buildRationale(signals, top) {
  const veg = (signals.vegetationIndex * 100).toFixed(0);
  const sun = (signals.openSunIndex * 100).toFixed(0);
  const wet = (signals.moistureHint * 100).toFixed(0);
  const parts = [
    `Scene cues: vegetation ~${veg}%, open-sun exposure ~${sun}%, moisture proxy ~${wet}%.`,
  ];
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
    parts.push(`Weather now: temp ${temp}, humidity ${hum}, precip ${rain}.`);
  }
  if (signals.areaM2 != null) {
    parts.push(`Area: ~${signals.areaM2.toFixed(0)} m².`);
  }
  if (
    signals.soilPh != null ||
    signals.drainageIndex != null ||
    signals.textureIndex != null
  ) {
    const bits = [];
    if (signals.soilPh != null) bits.push(`pH ${signals.soilPh.toFixed(1)}`);
    if (signals.drainageIndex != null) bits.push("drainage considered");
    if (signals.textureIndex != null) bits.push("texture considered");
    if (bits.length) parts.push(`Soil: ${bits.join(", ")}.`);
  }
  parts.push(`Best match: ${top.commonName} — ${top.notes}`);
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

export function rankSeedlingsFromSignals(signals) {
  const u = unsuitableForPlanting(signals);
  const items = catalog.seedlings.map((s) => ({
    seedling: s,
    penalty: penaltyForSeedling(s, signals),
  }));
  items.sort((a, b) => a.penalty - b.penalty);
  const maxP = Math.max(...items.map((x) => x.penalty), 1e-6);

  const rankedSeedlings = items.map((x) => ({
    seedling: toPublicSeedling(x.seedling),
    matchPercent: matchPercent(x.penalty, maxP),
  }));

  if (u.unsuitable) {
    return {
      recommended: null,
      alternatives: [],
      rankedSeedlings: [],
      confidence: 0,
      rationale: u.reason,
      signals,
      unsuitableForPlanting: true,
      unsuitableReason: u.reason,
      estimatedSeedlingsNeeded: estimatedSeedlingsFromSignals(signals),
    };
  }

  const best = items[0];
  const confidence = clamp01(1 - best.penalty / (maxP * 1.35));

  return {
    recommended: toPublicSeedling(best.seedling),
    alternatives: items.slice(1, 4).map((x) => toPublicSeedling(x.seedling)),
    rankedSeedlings,
    confidence,
    rationale: buildRationale(signals, best.seedling),
    signals,
    unsuitableForPlanting: false,
    unsuitableReason: null,
    estimatedSeedlingsNeeded: estimatedSeedlingsFromSignals(signals),
  };
}

/**
 * @param {{
 *   base64: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 *   area_m2?: number | null,
 *   soil?: { ph?: number, drainage?: string, texture?: string } | null,
 *   weatherSignals?: Record<string, number>,
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

  const soilMerged = mergeSoilIntoSignals(input.soil);
  signals = { ...signals, ...soilMerged };

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

  const ranked = rankSeedlingsFromSignals(signals);
  const estimatedSeedlingsNeeded =
    ranked.estimatedSeedlingsNeeded ??
    estimatedSeedlingsFromSignals(ranked.signals ?? signals);
  return { source: "local", ...ranked, estimatedSeedlingsNeeded };
}
