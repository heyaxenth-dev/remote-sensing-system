/**
 * DENR PENRO NGP species recommendations — rank only species on the site's contract list.
 */

import { haversineMeters, normalizeSpeciesToken } from "./penroDataAccuracy";

const profilesData = require("../data/penro-species-profiles.json");

const CATEGORY_KEYWORDS = [
  { category: "bamboo", re: /kawayan|bamboo|buho/i },
  { category: "understory", re: /coffee|cacao|abaca/i },
  { category: "fruit", re: /mango|jackfruit|rambutan|guyabano|duhat|santol|cashew|lansones|avocado|atis|banana|papaya|calamansi|pili|coffee|cacao|lanzones/i },
  { category: "pioneer_exotic", re: /mahogany|gmelina|ipil|kakawate|acacia|agoho|alibangbang/i },
  { category: "native_timber", re: /narra|badlan|balod|toog|molave|antipolo|kamagong|lawaan|lawaan|talisay|batwan|inyam|tapuyay/i },
];

/** @param {string} text */
export function parseSpeciesPlanted(text) {
  if (!text || typeof text !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const part of text.split(/[,;/]+/)) {
    let name = part.trim().replace(/^\*+/, "").replace(/\s+/g, " ");
    if (!name || name.length < 2) continue;
    const key = normalizeSpeciesToken(name);
    if (!key || key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** @param {string} name */
export function speciesIdFromName(name) {
  const key = normalizeSpeciesToken(name);
  return key || "species";
}

function inferCategory(name) {
  const n = normalizeSpeciesToken(name);
  for (const { category, re } of CATEGORY_KEYWORDS) {
    if (re.test(name) || re.test(n)) return category;
  }
  return "general";
}

function profileForName(name) {
  const key = normalizeSpeciesToken(name);
  const explicit = profilesData.profiles?.[key];
  const category = explicit?.category || inferCategory(name);
  const cat = profilesData.categories?.[category] || profilesData.categories?.general;
  const prefs = explicit?.preferences || cat?.preferences || {};
  const notesSuffix = cat?.notesSuffix || profilesData.categories?.general?.notesSuffix;
  return {
    scientificName: explicit?.scientificName || "",
    category,
    preferences: prefs,
    notes: explicit?.notes || notesSuffix,
  };
}

/**
 * @param {object} plot - reforestation_plots / PENRO bundle row
 */
export function buildSeedlingsFromPenroPlot(plot) {
  if (!plot?.species_planted) return [];
  const site = plot.site_code || plot.plot_code || "NGP site";
  const survivalPct =
    typeof plot.latest_survival_rate === "number"
      ? Math.round(plot.latest_survival_rate * 100)
      : null;

  return parseSpeciesPlanted(plot.species_planted).map((commonName) => {
    const profile = profileForName(commonName);
    const survivalNote =
      survivalPct != null
        ? ` PENRO reported survival ~${survivalPct}% for this site.`
        : "";
    return {
      id: speciesIdFromName(commonName),
      commonName,
      scientificName: profile.scientificName,
      notes: `DENR NGP contract species (${site}). ${profile.notes}${survivalNote}`,
      preferences: profile.preferences,
      penroContract: true,
    };
  });
}

/**
 * Stocking estimate from PENRO contracted density applied to assessed plantable area.
 * @param {object} plot
 * @param {{ areaM2?: number, plantableAreaSqM?: number }} areaContext
 */
export function estimateSeedlingsFromPenroPlot(plot, areaContext = {}) {
  const areaHa = Number(plot?.area_ha);
  const contracted = Number(plot?.seedlings_contracted ?? plot?.target_seedlings);
  const plantable =
    typeof areaContext.plantableAreaSqM === "number" && areaContext.plantableAreaSqM > 0
      ? areaContext.plantableAreaSqM
      : typeof areaContext.areaM2 === "number" && areaContext.areaM2 > 0
        ? areaContext.areaM2
        : 250;

  if (areaHa > 0 && contracted > 0) {
    const siteM2 = areaHa * 10_000;
    const density = contracted / siteM2;
    return Math.max(1, Math.round(density * plantable));
  }
  return Math.max(1, Math.ceil(plantable / 4));
}

/**
 * @param {object[]} plots
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [maxMeters=3500]
 */
export function findNearestPenroPlot(plots, latitude, longitude, maxMeters = 3500) {
  if (!plots?.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const p of plots) {
    const lat = Number(p.latitude);
    const lon = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const d = haversineMeters(latitude, longitude, lat, lon);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best || bestD > maxMeters) return null;
  return { plot: best, distanceMeters: Math.round(bestD) };
}

/**
 * @param {object | null} plot
 * @param {{ distanceMeters?: number } | null} nearestMeta
 */
export function penroRecommendationContext(plot, nearestMeta) {
  if (!plot) {
    return {
      plot: null,
      siteCode: null,
      source: "none",
      label: "Select an NGP site to rank DENR contract species.",
    };
  }
  const siteCode = plot.site_code || plot.plot_code;
  if (nearestMeta?.distanceMeters != null) {
    return {
      plot,
      siteCode,
      source: "gps_nearest",
      label: `Nearest NGP site ${siteCode} (~${nearestMeta.distanceMeters} m) — DENR contract species.`,
    };
  }
  return {
    plot,
    siteCode,
    source: "selected",
    label: `NGP site ${siteCode} — species ranked from DENR PENRO contract list.`,
  };
}
