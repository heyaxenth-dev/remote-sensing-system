import { isRejectedFieldCapture } from "./captureValidity";
import { estimatedSeedlingsFromSignals } from "./seedlingAnalysisLocal";
import { computePenroDataAccuracy } from "./penroDataAccuracy";
import { supabase } from "./supabase";
import { uploadFieldCaptureJpeg } from "./fieldCaptureUpload";

function estimateFromRecommendation(recommendation) {
  if (
    recommendation?.unsuitableForPlanting ||
    recommendation?.captureValidity?.isValidFieldCapture === false
  ) {
    return null;
  }
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
  plotId = null,
  plotRecord = null,
  gridCell = null,
  userId = null,
  locationSource = null,
  accuracyMeters = null,
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
  const sceneAreaSqM =
    recommendation?.signals?.sceneAreaSqM ??
    recommendation?.signals?.areaSqM ??
    null;

  const penroAccuracy = computePenroDataAccuracy(plotRecord, {
    latitude,
    longitude,
    seedling,
    estimatedSeedlings: est,
    accuracyMeters,
    plotSelected: Boolean(plotId),
    sceneAreaSqM,
  });

  const match =
    typeof selectedMatchPercent === "number" && !Number.isNaN(selectedMatchPercent)
      ? selectedMatchPercent
      : null;
  const confidenceFromMatch =
    match != null ? Math.min(1, Math.max(0, match / 100)) : null;

  const rawAnalysis = {
    userConfirmed: true,
    confirmedAt: new Date().toISOString(),
    locationSource: locationSource ?? null,
    accuracyMeters: accuracyMeters ?? null,
    gridCell: gridCell ?? null,
    selectedMatchPercent: match,
    selectedSeedling: seedling
      ? {
          id: seedling.id,
          commonName: seedling.commonName ?? null,
          scientificName: seedling.scientificName ?? null,
        }
      : null,
    estimatedSeedlingsNeeded: est,
    penroAccuracy,
    analysis: sanitizeRawAnalysis(recommendation),
  };

  const payload = {
    event_type: "monitor_seedling",
    latitude,
    longitude,
    user_id: userId ?? null,
    plot_id: plotId ?? null,
    grid_cell: gridCell ?? null,
    verification_status: "pending",
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
    penro_accuracy_score: penroAccuracy.overallScore,
    penro_accuracy_detail: penroAccuracy,
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
 * Record aerial / forest-area site assessment for monitoring (every capture).
 * Tracks plantability, canopy cover, and health cues even when not confirming a seedling.
 */
export async function insertSceneAssessmentSubmission({
  latitude,
  longitude,
  recommendation,
  imageBase64 = null,
  plotId = null,
  plotRecord = null,
  gridCell = null,
  userId = null,
  locationSource = null,
  accuracyMeters = null,
}) {
  if (isRejectedFieldCapture(recommendation)) {
    throw new Error(
      recommendation?.captureValidity?.reason ||
        recommendation?.unsuitableReason ||
        "Only outdoor land or aerial NGP plot views can be recorded.",
    );
  }

  const forestArea = recommendation?.forestArea ?? null;
  const isPlantable = forestArea?.isPlantable !== false && !recommendation?.unsuitableForPlanting;
  const est = estimateFromRecommendation(recommendation);

  let imageUrl = null;
  if (imageBase64) {
    imageUrl = await uploadFieldCaptureJpeg(imageBase64);
  }

  const rawAnalysis = {
    sceneAssessment: true,
    assessedAt: new Date().toISOString(),
    locationSource: locationSource ?? null,
    accuracyMeters: accuracyMeters ?? null,
    gridCell: gridCell ?? null,
    forestArea,
    captureValidity: recommendation?.captureValidity ?? null,
    estimatedSeedlingsNeeded: est,
    analysis: sanitizeRawAnalysis(recommendation),
  };

  const payload = {
    event_type: "scene_analysis",
    latitude,
    longitude,
    user_id: userId ?? null,
    plot_id: plotId ?? null,
    grid_cell: gridCell ?? null,
    verification_status: "pending",
    estimated_seedlings_needed: est,
    seedling_id: null,
    common_name: null,
    scientific_name: null,
    confidence: forestArea?.plantabilityScore != null ? forestArea.plantabilityScore / 100 : null,
    rationale: forestArea?.summary ?? recommendation?.rationale ?? null,
    unsuitable_for_planting: !isPlantable,
    raw_analysis: rawAnalysis,
    image_url: imageUrl,
    penro_accuracy_score: null,
    penro_accuracy_detail: null,
  };

  const { data, error } = await supabase
    .from("monitoring_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
