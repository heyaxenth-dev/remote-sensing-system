import { estimatedSeedlingsFromSignals } from "./seedlingAnalysisLocal";
import { supabase } from "./supabase";

function estimateFromRecommendation(recommendation) {
  if (
    recommendation &&
    typeof recommendation.estimatedSeedlingsNeeded === "number" &&
    !Number.isNaN(recommendation.estimatedSeedlingsNeeded)
  ) {
    return Math.max(1, Math.round(recommendation.estimatedSeedlingsNeeded));
  }
  return estimatedSeedlingsFromSignals(recommendation?.signals);
}

function sanitizeRawAnalysis(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return null;
  try {
    return JSON.parse(JSON.stringify(recommendation));
  } catch {
    return null;
  }
}

/**
 * Persist a full scene analysis (Python API or on-device) for the admin Data & Verification view.
 */
export async function insertSceneAnalysisSubmission({
  latitude,
  longitude,
  recommendation,
}) {
  const est = estimateFromRecommendation(recommendation);
  const rec = recommendation?.recommended;
  const payload = {
    event_type: "scene_analysis",
    latitude,
    longitude,
    estimated_seedlings_needed: est,
    seedling_id: rec?.id ?? null,
    common_name: rec?.commonName ?? null,
    scientific_name: rec?.scientificName ?? null,
    confidence:
      recommendation?.confidence != null
        ? Number(recommendation.confidence)
        : null,
    rationale:
      typeof recommendation?.rationale === "string"
        ? recommendation.rationale
        : null,
    unsuitable_for_planting: Boolean(recommendation?.unsuitableForPlanting),
    raw_analysis: sanitizeRawAnalysis(recommendation),
    image_url: null,
  };

  const { data, error } = await supabase
    .from("monitoring_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * User chose “Monitor this seedling” after analysis.
 */
export async function insertMonitorSeedlingSubmission({
  latitude,
  longitude,
  seedling,
  recommendation,
}) {
  const est = estimateFromRecommendation(recommendation);
  const payload = {
    event_type: "monitor_seedling",
    latitude,
    longitude,
    estimated_seedlings_needed: est,
    seedling_id: seedling?.id ?? null,
    common_name: seedling?.commonName ?? null,
    scientific_name: seedling?.scientificName ?? null,
    confidence: null,
    rationale:
      typeof recommendation?.rationale === "string"
        ? recommendation.rationale
        : null,
    unsuitable_for_planting: false,
    raw_analysis: null,
    image_url: null,
  };

  const { data, error } = await supabase
    .from("monitoring_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
