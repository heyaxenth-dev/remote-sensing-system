import { analyzeSeedlingLocally } from "./seedlingAnalysisLocal";
import { normalizeAnalysisResult } from "./normalizeAnalysisResult";
import { penroRecommendationContext } from "./penroSpeciesRecommendations";
import { fetchOpenMeteoSignalsForRecommend } from "./weather";

function serializePenroPlot(plot) {
  if (!plot) return null;
  return {
    site_code: plot.site_code ?? plot.plot_code ?? null,
    plot_code: plot.plot_code ?? plot.site_code ?? null,
    species_planted: plot.species_planted ?? null,
    area_ha: plot.area_ha ?? null,
    seedlings_contracted:
      plot.seedlings_contracted ?? plot.target_seedlings ?? null,
    target_seedlings: plot.target_seedlings ?? null,
    latest_survival_rate: plot.latest_survival_rate ?? null,
  };
}

function normalizeBaseUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/\/+$/, "");
}

/**
 * Aerial scene analysis for plantable-area monitoring and optional seedling hints.
 * Uses image cues + GPS; no soil database lookup.
 *
 * @param {{
 *   base64: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 *   area_m2?: number | null,
 *   plot?: object | null,
 *   nearestMeta?: { distanceMeters?: number } | null,
 * }} input
 */
export async function analyzeSeedlingCapture(input) {
  const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_ANALYZE_API_URL);
  const penroPlot = serializePenroPlot(input.plot);

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
          penro_plot: penroPlot,
        }),
      });
      if (res.ok) {
        const remote = await res.json();
        return normalizeAnalysisResult(remote);
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

  const penroContext = penroRecommendationContext(
    input.plot ?? null,
    input.nearestMeta ?? null,
  );

  return normalizeAnalysisResult(
    analyzeSeedlingLocally({
      base64: input.base64,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      area_m2: input.area_m2 ?? null,
      weatherSignals,
      plot: input.plot ?? null,
      nearestMeta: input.nearestMeta ?? null,
      penroContext,
    }),
  );
}
