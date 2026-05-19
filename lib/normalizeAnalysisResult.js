import { assessCaptureValidity, isRejectedFieldCapture } from "./captureValidity";
import { assessForestAreaFromSignals } from "./forestAreaAssessment";

/**
 * Re-apply client-side field-capture rules (remote API may be stale or bypass checks).
 * @param {object | null} result
 */
export function normalizeAnalysisResult(result) {
  if (!result?.signals || typeof result.signals !== "object") {
    return result;
  }

  const signals = result.signals;
  const captureValidity = assessCaptureValidity(signals);
  const forestArea = assessForestAreaFromSignals(signals);

  if (!isRejectedFieldCapture({ captureValidity, forestArea })) {
    return {
      ...result,
      captureValidity,
      forestArea,
    };
  }

  const reason =
    captureValidity.reason ||
    forestArea.summary ||
    "Not a valid field capture.";

  return {
    ...result,
    captureValidity,
    forestArea,
    unsuitableForPlanting: true,
    unsuitableReason: reason,
    recommended: null,
    alternatives: [],
    rankedSeedlings: [],
    confidence: 0,
    rationale: reason,
    estimatedSeedlingsNeeded: null,
    denrPlotRequired: false,
  };
}
