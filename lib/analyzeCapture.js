import { analyzeSeedlingLocally } from "./seedlingAnalysisLocal";
import { fetchSoilProfileForLocation } from "./soilLookup";
import { supabase } from "./supabase";
import { fetchOpenMeteoSignalsForRecommend } from "./weather";

function normalizeBaseUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/\/+$/, "");
}

/**
 * Captures are analyzed remotely when EXPO_PUBLIC_ANALYZE_API_URL is set (Python FastAPI service),
 * otherwise the same heuristic runs on-device via jpeg-js.
 *
 * GrowCalendar-aligned inputs: optional area + soil (or soil resolved from Supabase by coordinates).
 *
 * @param {{
 *   base64: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 *   area_m2?: number | null,
 *   soil?: { ph: number, drainage: string, texture: string } | null,
 * }} input
 */
export async function analyzeSeedlingCapture(input) {
  const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_ANALYZE_API_URL);

  let soilPayload = input.soil ?? null;
  if (
    !soilPayload &&
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    try {
      soilPayload = await fetchSoilProfileForLocation(
        supabase,
        input.latitude,
        input.longitude,
      );
    } catch (e) {
      console.warn("[analyzeSeedlingCapture] Soil lookup skipped:", e);
    }
  }

  const remoteSoil =
    soilPayload &&
    typeof soilPayload.ph === "number" &&
    soilPayload.drainage &&
    soilPayload.texture
      ? {
          ph: soilPayload.ph,
          drainage: soilPayload.drainage,
          texture: soilPayload.texture,
        }
      : null;

  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: input.base64,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          area_m2: input.area_m2 ?? null,
          soil: remoteSoil,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
      const text = await res.text();
      throw new Error(text || `Analyze HTTP ${res.status}`);
    } catch (e) {
      console.warn("[analyzeSeedlingCapture] Remote failed, using local:", e);
    }
  }

  let weatherSignals = {};
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    try {
      weatherSignals = await fetchOpenMeteoSignalsForRecommend(
        input.latitude,
        input.longitude,
      );
    } catch (e) {
      console.warn("[analyzeSeedlingCapture] Weather fetch failed:", e);
    }
  }

  return analyzeSeedlingLocally({
    base64: input.base64,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    area_m2: input.area_m2 ?? null,
    soil: soilPayload,
    weatherSignals,
  });
}
