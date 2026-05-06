import jpeg from "jpeg-js";
import catalog from "../data/seedling-catalog.json";

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function computeSignalsFromRgba(rgba, width, height) {
  const stride = Math.max(4, Math.round(Math.min(width, height) / 48));
  let total = 0;
  let greenish = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLum = 0;

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
      if (g > r + 12 && g > b + 12) greenish += 1;
    }
  }

  if (!total) {
    return {
      vegetationIndex: 0,
      openSunIndex: 0.5,
      moistureHint: 0.5,
      greenRatio: 0,
      meanLuminance: 0.5,
    };
  }

  const greenRatio = greenish / total;
  const meanR = sumR / total;
  const meanG = sumG / total;
  const meanB = sumB / total;
  const meanLum = sumLum / total;
  const denom = Math.max(1, meanR + meanG + meanB);
  const openSunIndex = clamp01(meanLum * 0.65 + (1 - greenRatio) * 0.35);
  const moistureHint = clamp01(
    (meanB / denom) * 3 * 0.42 + greenRatio * 0.33 + meanLum * 0.25,
  );

  return {
    vegetationIndex: clamp01(greenRatio),
    openSunIndex,
    moistureHint,
    greenRatio: clamp01(greenRatio),
    meanLuminance: clamp01(meanLum),
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
  return penalty;
}

function buildRationale(signals, top) {
  const veg = (signals.vegetationIndex * 100).toFixed(0);
  const sun = (signals.openSunIndex * 100).toFixed(0);
  const wet = (signals.moistureHint * 100).toFixed(0);
  return `Scene cues: vegetation ~${veg}%, open-sun exposure ~${sun}%, moisture proxy ~${wet}%. Best match: ${top.commonName} — ${top.notes}`;
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
  const items = catalog.seedlings.map((s) => ({
    seedling: s,
    penalty: penaltyForSeedling(s, signals),
  }));
  items.sort((a, b) => a.penalty - b.penalty);
  const maxP = Math.max(...items.map((x) => x.penalty), 1e-6);
  const best = items[0];
  const confidence = clamp01(1 - best.penalty / (maxP * 1.35));

  return {
    recommended: toPublicSeedling(best.seedling),
    alternatives: items.slice(1, 4).map((x) => toPublicSeedling(x.seedling)),
    confidence,
    rationale: buildRationale(signals, best.seedling),
    signals,
  };
}

/**
 * @param {{ base64: string, latitude?: number | null, longitude?: number | null }} input
 */
export function analyzeSeedlingLocally(input) {
  const bytes = base64ToUint8Array(input.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  if (!decoded?.data || !decoded.width || !decoded.height) {
    throw new Error("Could not decode capture for analysis");
  }
  const signals = computeSignalsFromRgba(
    decoded.data,
    decoded.width,
    decoded.height,
  );

  const ranked = rankSeedlingsFromSignals(signals);
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    ranked.signals = {
      ...ranked.signals,
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  return { source: "local", ...ranked };
}
