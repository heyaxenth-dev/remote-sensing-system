import { estimatedSeedlingsFromSignals } from "./seedlingAnalysisLocal";
import { supabase } from "./supabase";
import { uploadFieldCaptureJpeg } from "./fieldCaptureUpload";

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
 * User confirmed a seedling after analysis; this is the only mobile write to
 * `monitoring_submissions` (no automatic scene rows). Optional JPEG is uploaded
 * and linked via `image_url`.
 */
export async function insertMonitorSeedlingSubmission({
  latitude,
  longitude,
  seedling,
  recommendation,
  selectedMatchPercent = null,
  imageBase64 = null,
}) {
  let imageUrl = null;
  if (imageBase64) {
    imageUrl = await uploadFieldCaptureJpeg(imageBase64);
    if (!imageUrl) {
      throw new Error(
        "Could not upload the capture photo. Add the `field-captures` storage bucket (see supabase/schema.sql), then try again.",
      );
    }
  }

  const est = estimateFromRecommendation(recommendation);
  const match =
    typeof selectedMatchPercent === "number" && !Number.isNaN(selectedMatchPercent)
      ? selectedMatchPercent
      : null;
  const confidenceFromMatch =
    match != null ? Math.min(1, Math.max(0, match / 100)) : null;

  const rawAnalysis = {
    userConfirmed: true,
    confirmedAt: new Date().toISOString(),
    selectedMatchPercent: match,
    selectedSeedling: seedling
      ? {
          id: seedling.id,
          commonName: seedling.commonName ?? null,
          scientificName: seedling.scientificName ?? null,
        }
      : null,
    estimatedSeedlingsNeeded: est,
    analysis: sanitizeRawAnalysis(recommendation),
  };

  const payload = {
    event_type: "monitor_seedling",
    latitude,
    longitude,
    estimated_seedlings_needed: est,
    seedling_id: seedling?.id ?? null,
    common_name: seedling?.commonName ?? null,
    scientific_name: seedling?.scientificName ?? null,
    confidence: confidenceFromMatch,
    rationale:
      typeof recommendation?.rationale === "string"
        ? recommendation.rationale
        : null,
    unsuitable_for_planting: false,
    raw_analysis: rawAnalysis,
    image_url: imageUrl,
  };

  const { data, error } = await supabase
    .from("monitoring_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
