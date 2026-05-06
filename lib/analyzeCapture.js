import { analyzeSeedlingLocally } from "./seedlingAnalysisLocal";

function normalizeBaseUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/\/+$/, "");
}

/**
 * Captures are analyzed remotely when EXPO_PUBLIC_ANALYZE_API_URL is set (Python FastAPI service),
 * otherwise the same heuristic runs on-device via jpeg-js.
 *
 * @param {{ base64: string, latitude?: number | null, longitude?: number | null }} input
 */
export async function analyzeSeedlingCapture(input) {
  const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_ANALYZE_API_URL);

  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: input.base64,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
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

  return analyzeSeedlingLocally(input);
}
