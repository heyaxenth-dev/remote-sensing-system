/**
 * Survival rate & health trend helpers (field progress vs PENRO NGP baselines).
 */

const STATUS_SURVIVAL_WEIGHT = {
  planned: null,
  planted: 0.55,
  growing: 0.85,
  monitored: 1,
};

const STATUS_HEALTH = {
  planned: "pending",
  planted: "at_risk",
  growing: "healthy",
  monitored: "healthy",
};

export function fieldSurvivalPercentFromStatus(status) {
  const w = STATUS_SURVIVAL_WEIGHT[status];
  if (w == null) return null;
  return Math.round(w * 100);
}

export function healthLabelFromStatus(status) {
  return STATUS_HEALTH[status] ?? "unknown";
}

/**
 * Compare field-estimated survival to PENRO latest survival rate (0–1).
 */
export function compareSurvivalToPenro(fieldSurvivalPct, penroLatestRate) {
  if (fieldSurvivalPct == null || penroLatestRate == null) {
    return { deltaPct: null, trend: "unknown", label: "Awaiting data" };
  }
  const baseline = Math.round(Number(penroLatestRate) * 100);
  const delta = fieldSurvivalPct - baseline;
  let trend = "on_track";
  let label = "On track with PENRO baseline";
  if (delta >= 10) {
    trend = "above_baseline";
    label = "Above PENRO baseline";
  } else if (delta <= -15) {
    trend = "below_baseline";
    label = "Below PENRO baseline — review site";
  } else if (delta <= -5) {
    trend = "watch";
    label = "Slightly below baseline — monitor";
  }
  return { deltaPct: delta, baselinePct: baseline, trend, label };
}

export function aggregateSurvivalSummary(progressRows, plotsById = {}) {
  let healthy = 0;
  let atRisk = 0;
  let pending = 0;
  const fieldRates = [];

  for (const row of progressRows) {
    const health = healthLabelFromStatus(row.status);
    if (health === "healthy") healthy += 1;
    else if (health === "at_risk") atRisk += 1;
    else pending += 1;

    const pct = fieldSurvivalPercentFromStatus(row.status);
    if (pct != null) fieldRates.push(pct);
  }

  const fieldSurvivalPct = fieldRates.length
    ? Math.round(fieldRates.reduce((a, b) => a + b, 0) / fieldRates.length)
    : null;

  const penroRates = Object.values(plotsById)
    .map((p) => p?.latest_survival_rate)
    .filter((r) => typeof r === "number" && !Number.isNaN(r));
  const penroBaselinePct = penroRates.length
    ? Math.round(
        (penroRates.reduce((a, b) => a + Number(b), 0) / penroRates.length) * 100,
      )
    : null;

  const comparison = compareSurvivalToPenro(fieldSurvivalPct, penroBaselinePct / 100);

  return {
    healthy,
    atRisk,
    pending,
    fieldSurvivalPct,
    penroBaselinePct,
    comparison,
  };
}
