import { getSupabase, isSupabaseConfigured } from "./supabase";

export type VerificationStatus = "pending" | "confirmed" | "flagged";

export type MonitoringRow = {
  id: string;
  created_at: string;
  event_type: "scene_analysis" | "monitor_seedling";
  latitude: number;
  longitude: number;
  estimated_seedlings_needed: number;
  seedling_id: string | null;
  common_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  rationale: string | null;
  unsuitable_for_planting: boolean;
  raw_analysis: Record<string, unknown> | null;
  image_url: string | null;
  user_id: string | null;
  plot_id: string | null;
  grid_cell: string | null;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  penro_accuracy_score: number | null;
  penro_accuracy_detail: Record<string, unknown> | null;
};

export type ReforestationPlot = {
  id: string;
  plot_code: string;
  site_code?: string | null;
  name: string;
  po_name?: string | null;
  barangay: string | null;
  municipality: string;
  latitude: number;
  longitude: number;
  target_seedlings: number;
  seedlings_contracted?: number | null;
  area_ha?: number | null;
  species_planted?: string | null;
  latest_survival_rate?: number | null;
  third_year_survival_rate?: number | null;
  program_year: number | null;
};

export type SeedlingProgressRow = {
  id: string;
  user_id: string;
  plot_id: string | null;
  seedling_id: string;
  common_name: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
};

export async function loadMonitoringSubmissions(limit = 500): Promise<MonitoringRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("monitoring_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    verification_status: (row.verification_status ?? "pending") as VerificationStatus,
  })) as MonitoringRow[];
}

export async function loadReforestationPlots(): Promise<ReforestationPlot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reforestation_plots")
    .select("*")
    .order("plot_code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReforestationPlot[];
}

export async function loadSeedlingProgress(limit = 1000): Promise<SeedlingProgressRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("seedling_progress")
    .select("id, user_id, plot_id, seedling_id, common_name, status, notes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SeedlingProgressRow[];
}

export async function updateSubmissionVerification(
  id: string,
  patch: {
    verification_status: VerificationStatus;
    verification_notes?: string | null;
  },
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase
    .from("monitoring_submissions")
    .update({
      verification_status: patch.verification_status,
      verification_notes: patch.verification_notes ?? null,
      verified_at: new Date().toISOString(),
      verified_by: session?.user?.id ?? null,
    })
    .eq("id", id);

  if (error) throw error;
}

const ALIVE_STATUSES = new Set(["growing", "monitored"]);
const AT_RISK_STATUSES = new Set(["planted"]);
const PENDING_STATUSES = new Set(["planned"]);

export type PlotSurvivalMetric = {
  plotId: string;
  plotCode: string;
  name: string;
  targetSeedlings: number;
  survivalPct: number;
  penroBaselineSurvivalPct: number | null;
  avgAccuracyPct: number | null;
  healthy: number;
  atRisk: number;
  pending: number;
  submissionCount: number;
};

export type KpiSummary = {
  overallSurvivalPct: number;
  penroBaselineSurvivalPct: number | null;
  avgDataAccuracyPct: number | null;
  avgPlantabilityPct: number | null;
  avgCanopyPct: number | null;
  avgHealthIndexPct: number | null;
  plantableCapturePct: number | null;
  healthy: number;
  atRisk: number;
  pending: number;
  treesCounted: number;
  treesTarget: number;
  growthLabel: string;
  siteHealthLabel: string;
  plotMetrics: PlotSurvivalMetric[];
  monthlySubmissions: { month: string; count: number }[];
  monthlySurvival: { month: string; pct: number }[];
  monthlyPenroSurvival: { month: string; pct: number }[];
  monthlyAccuracy: { month: string; pct: number }[];
  monthlyPlantability: { month: string; pct: number }[];
  monthlyHealthIndex: { month: string; pct: number }[];
};

function forestFromSubmission(row: MonitoringRow): {
  plantabilityScore?: number;
  forestCanopyPct?: number;
  healthIndex?: number;
  isPlantable?: boolean;
} | null {
  const raw = row.raw_analysis;
  if (!raw || typeof raw !== "object") return null;
  const fa =
    (raw as { forestArea?: Record<string, unknown> }).forestArea ??
    (raw as { analysis?: { forestArea?: Record<string, unknown> } }).analysis?.forestArea;
  if (!fa || typeof fa !== "object") return null;
  return fa as {
    plantabilityScore?: number;
    forestCanopyPct?: number;
    healthIndex?: number;
    isPlantable?: boolean;
  };
}

export function computeKpiSummary(
  progressRows: SeedlingProgressRow[],
  plots: ReforestationPlot[],
  submissions: MonitoringRow[],
): KpiSummary {
  let healthy = 0;
  let atRisk = 0;
  let pending = 0;

  for (const row of progressRows) {
    if (ALIVE_STATUSES.has(row.status)) healthy += 1;
    else if (AT_RISK_STATUSES.has(row.status)) atRisk += 1;
    else if (PENDING_STATUSES.has(row.status)) pending += 1;
  }

  const assessed = healthy + atRisk;
  const overallSurvivalPct =
    assessed > 0 ? Math.round((healthy / assessed) * 100) : submissions.length > 0 ? 0 : 0;

  const accuracyScores = submissions
    .map((s) => s.penro_accuracy_score)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  const avgDataAccuracyPct = accuracyScores.length
    ? Math.round(accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length)
    : null;

  const sceneSubs = submissions.filter((s) => s.event_type === "scene_analysis");
  const forestMetrics = sceneSubs.map((s) => forestFromSubmission(s)).filter(Boolean) as NonNullable<
    ReturnType<typeof forestFromSubmission>
  >[];
  const plantScores = forestMetrics
    .map((f) => f.plantabilityScore)
    .filter((n): n is number => typeof n === "number");
  const canopyScores = forestMetrics
    .map((f) => f.forestCanopyPct)
    .filter((n): n is number => typeof n === "number");
  const healthScores = forestMetrics
    .map((f) => f.healthIndex)
    .filter((n): n is number => typeof n === "number");
  const avgPlantabilityPct = plantScores.length
    ? Math.round(plantScores.reduce((a, b) => a + b, 0) / plantScores.length)
    : null;
  const avgCanopyPct = canopyScores.length
    ? Math.round(canopyScores.reduce((a, b) => a + b, 0) / canopyScores.length)
    : null;
  const avgHealthIndexPct = healthScores.length
    ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
    : null;
  const plantableCount = forestMetrics.filter((f) => f.isPlantable === true).length;
  const plantableCapturePct =
    forestMetrics.length > 0
      ? Math.round((plantableCount / forestMetrics.length) * 100)
      : null;

  const penroBaselines = plots
    .map((p) =>
      p.latest_survival_rate != null
        ? Math.round(Number(p.latest_survival_rate) * 100)
        : p.third_year_survival_rate != null
          ? Math.round(Number(p.third_year_survival_rate) * 100)
          : null,
    )
    .filter((n): n is number => n != null);
  const penroBaselineSurvivalPct = penroBaselines.length
    ? Math.round(penroBaselines.reduce((a, b) => a + b, 0) / penroBaselines.length)
    : null;

  const treesTarget = plots.reduce(
    (s, p) => s + (p.seedlings_contracted ?? p.target_seedlings ?? 0),
    0,
  );
  const treesCounted =
    submissions
      .filter((s) => s.event_type === "monitor_seedling")
      .reduce((s, r) => s + Number(r.estimated_seedlings_needed || 0), 0) || healthy + atRisk;

  const plotMetrics: PlotSurvivalMetric[] = plots.map((plot) => {
    const plotProgress = progressRows.filter((r) => r.plot_id === plot.id);
    let pHealthy = 0;
    let pAtRisk = 0;
    let pPending = 0;
    for (const row of plotProgress) {
      if (ALIVE_STATUSES.has(row.status)) pHealthy += 1;
      else if (AT_RISK_STATUSES.has(row.status)) pAtRisk += 1;
      else pPending += 1;
    }
    const pAssessed = pHealthy + pAtRisk;
    const survivalPct =
      pAssessed > 0
        ? Math.round((pHealthy / pAssessed) * 100)
        : plotProgress.length === 0
          ? 0
          : 0;
    const plotSubs = submissions.filter((s) => s.plot_id === plot.id);
    const submissionCount = plotSubs.length;
    const plotAcc = plotSubs
      .map((s) => s.penro_accuracy_score)
      .filter((n): n is number => typeof n === "number");
    const avgAccuracyPct = plotAcc.length
      ? Math.round(plotAcc.reduce((a, b) => a + b, 0) / plotAcc.length)
      : null;
    const penroBaselineSurvivalPct =
      plot.latest_survival_rate != null
        ? Math.round(Number(plot.latest_survival_rate) * 100)
        : plot.third_year_survival_rate != null
          ? Math.round(Number(plot.third_year_survival_rate) * 100)
          : null;

    return {
      plotId: plot.id,
      plotCode: plot.site_code ?? plot.plot_code,
      name: plot.name,
      targetSeedlings: plot.seedlings_contracted ?? plot.target_seedlings,
      survivalPct,
      penroBaselineSurvivalPct,
      avgAccuracyPct,
      healthy: pHealthy,
      atRisk: pAtRisk,
      pending: pPending,
      submissionCount,
    };
  });

  const monthKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthLabels = (key: string) => {
    const [y, m] = key.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(m) - 1]} ${y.slice(2)}`;
  };

  const submissionBuckets = new Map<string, number>();
  for (const s of submissions) {
    const k = monthKey(s.created_at);
    submissionBuckets.set(k, (submissionBuckets.get(k) ?? 0) + 1);
  }

  const sortedMonths = [...submissionBuckets.keys()].sort().slice(-6);
  const monthlySubmissions = sortedMonths.map((k) => ({
    month: monthLabels(k),
    count: submissionBuckets.get(k) ?? 0,
  }));

  const monthlySurvival = sortedMonths.map((k) => ({
    month: monthLabels(k),
    pct: overallSurvivalPct,
  }));

  const monthlyPenroSurvival = sortedMonths.map((k) => ({
    month: monthLabels(k),
    pct: penroBaselineSurvivalPct ?? 0,
  }));

  const accuracyByMonth = new Map<string, number[]>();
  for (const s of submissions) {
    if (typeof s.penro_accuracy_score !== "number") continue;
    const k = monthKey(s.created_at);
    const arr = accuracyByMonth.get(k) ?? [];
    arr.push(s.penro_accuracy_score);
    accuracyByMonth.set(k, arr);
  }
  const monthlyAccuracy = sortedMonths.map((k) => {
    const arr = accuracyByMonth.get(k) ?? [];
    const pct = arr.length
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : avgDataAccuracyPct ?? 0;
    return { month: monthLabels(k), pct };
  });

  const plantByMonth = new Map<string, number[]>();
  const canopyByMonth = new Map<string, number[]>();
  const healthByMonth = new Map<string, number[]>();
  for (const s of sceneSubs) {
    const fa = forestFromSubmission(s);
    if (!fa) continue;
    const k = monthKey(s.created_at);
    if (typeof fa.plantabilityScore === "number") {
      const a = plantByMonth.get(k) ?? [];
      a.push(fa.plantabilityScore);
      plantByMonth.set(k, a);
    }
    if (typeof fa.forestCanopyPct === "number") {
      const a = canopyByMonth.get(k) ?? [];
      a.push(fa.forestCanopyPct);
      canopyByMonth.set(k, a);
    }
    if (typeof fa.healthIndex === "number") {
      const a = healthByMonth.get(k) ?? [];
      a.push(fa.healthIndex);
      healthByMonth.set(k, a);
    }
  }
  const monthlyPlantability = sortedMonths.map((k) => {
    const arr = plantByMonth.get(k) ?? [];
    return {
      month: monthLabels(k),
      pct: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : avgPlantabilityPct ?? 0,
    };
  });
  const monthlyHealthIndex = sortedMonths.map((k) => {
    const arr = healthByMonth.get(k) ?? [];
    return {
      month: monthLabels(k),
      pct: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : avgHealthIndexPct ?? 0,
    };
  });

  let siteHealthLabel = "No field data";
  if (assessed > 0) {
    if (overallSurvivalPct >= 85) siteHealthLabel = "Good";
    else if (overallSurvivalPct >= 70) siteHealthLabel = "Fair";
    else siteHealthLabel = "Needs attention";
  } else if (submissions.length > 0) {
    siteHealthLabel = "Awaiting progress updates";
  }

  return {
    overallSurvivalPct,
    penroBaselineSurvivalPct,
    avgDataAccuracyPct,
    avgPlantabilityPct,
    avgCanopyPct,
    avgHealthIndexPct,
    plantableCapturePct,
    healthy,
    atRisk,
    pending,
    treesCounted,
    treesTarget,
    growthLabel:
      monthlySubmissions.length >= 2
        ? `${monthlySubmissions[monthlySubmissions.length - 1].count} captures this month`
        : "Track growth via repeat plot visits",
    siteHealthLabel,
    plotMetrics,
    monthlySubmissions,
    monthlySurvival,
    monthlyPenroSurvival,
    monthlyAccuracy,
    monthlyPlantability,
    monthlyHealthIndex,
  };
}
