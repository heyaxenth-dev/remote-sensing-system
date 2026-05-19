export type PenroAccuracyCheck = {
  id: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type PenroPlotRef = {
  site_code?: string | null;
  plot_code?: string;
  latitude?: number;
  longitude?: number;
  species_planted?: string | null;
  seedlings_contracted?: number | null;
  target_seedlings?: number;
  area_ha?: number | null;
  latest_survival_rate?: number | null;
  third_year_survival_rate?: number | null;
};

export type PenroAccuracyResult = {
  overallScore: number | null;
  grade: "high" | "moderate" | "low" | "unknown";
  penroBaselineSurvivalPct: number | null;
  siteCode: string | null;
  seedlingsContracted: number | null;
  checks: PenroAccuracyCheck[];
  source: string;
};

const CULASI_LAT = 11.2886;
const CULASI_LON = 122.034;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeSpeciesToken(name: string | null | undefined): string {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function speciesListedInContract(
  commonName: string | null | undefined,
  speciesPlantedText: string | null | undefined,
): boolean | null {
  if (!commonName || !speciesPlantedText) return null;
  const needle = normalizeSpeciesToken(commonName);
  if (!needle) return null;
  const tokens = speciesPlantedText
    .split(/[,;/]+/)
    .map((t) => normalizeSpeciesToken(t))
    .filter(Boolean);
  return tokens.some(
    (t) => t.includes(needle) || needle.includes(t) || t.slice(0, 4) === needle.slice(0, 4),
  );
}

export function computePenroDataAccuracy(
  plot: PenroPlotRef | null | undefined,
  params: {
    latitude: number;
    longitude: number;
    seedling?: { commonName?: string | null } | null;
    estimatedSeedlings: number;
    accuracyMeters?: number | null;
    plotSelected?: boolean;
    sceneAreaSqM?: number | null;
  },
): PenroAccuracyResult {
  const checks: PenroAccuracyCheck[] = [];
  let weighted = 0;
  let totalWeight = 0;

  const add = (
    id: string,
    label: string,
    score: number,
    weight: number,
    detail: string,
  ) => {
    checks.push({ id, label, score, weight, detail });
    weighted += score * weight;
    totalWeight += weight;
  };

  if (plot?.site_code || plot?.plot_code) {
    add(
      "site_code",
      "NGP site code",
      params.plotSelected ? 100 : 70,
      20,
      params.plotSelected
        ? `Linked to ${plot.site_code ?? plot.plot_code}`
        : "Reference plot available; assign on capture",
    );
  } else {
    add("site_code", "NGP site code", 0, 20, "No PENRO site on record");
  }

  const refLat = plot?.latitude ?? CULASI_LAT;
  const refLon = plot?.longitude ?? CULASI_LON;
  const dist = haversineMeters(params.latitude, params.longitude, refLat, refLon);
  let gpsScore = 30;
  if (dist <= 50) gpsScore = 100;
  else if (dist <= 150) gpsScore = 85;
  else if (dist <= 500) gpsScore = 65;
  else if (dist <= 2000) gpsScore = 40;
  add("gps_position", "GPS vs NGP reference", gpsScore, 25, `${Math.round(dist)} m from site reference`);

  if (params.accuracyMeters != null) {
    let prec = 50;
    const a = params.accuracyMeters;
    if (a <= 10) prec = 100;
    else if (a <= 20) prec = 90;
    else if (a <= 50) prec = 75;
    else if (a <= 100) prec = 55;
    add("gps_precision", "GPS precision", prec, 15, `±${Math.round(a)} m reported`);
  } else {
    add("gps_precision", "GPS precision", 60, 15, "Precision not reported (survey fallback)");
  }

  const listed = speciesListedInContract(
    params.seedling?.commonName,
    plot?.species_planted ?? null,
  );
  if (listed === true) {
    add("species", "Species vs NGP contract", 100, 20, `${params.seedling?.commonName} in PENRO record`);
  } else if (listed === false) {
    add("species", "Species vs NGP contract", 35, 20, "Species not in contracted mix");
  } else {
    add("species", "Species vs NGP contract", 50, 20, "Cannot verify species");
  }

  const contracted = plot?.seedlings_contracted ?? plot?.target_seedlings;
  const areaHa = plot?.area_ha;
  if (contracted && areaHa && areaHa > 0 && params.estimatedSeedlings > 0) {
    const refDensity = contracted / areaHa;
    let fieldHa =
      params.sceneAreaSqM && params.sceneAreaSqM > 0 ? params.sceneAreaSqM / 10000 : 0.04;
    const fieldDensity = params.estimatedSeedlings / fieldHa;
    const ratio = fieldDensity / refDensity;
    let stockScore = 50;
    if (ratio >= 0.7 && ratio <= 1.35) stockScore = 100;
    else if (ratio >= 0.5 && ratio <= 1.6) stockScore = 75;
    else if (ratio >= 0.3 && ratio <= 2) stockScore = 50;
    else stockScore = 25;
    add(
      "stocking",
      "Stocking vs contracted",
      stockScore,
      20,
      `Field ~${Math.round(fieldDensity)}/ha vs NGP ${Math.round(refDensity)}/ha`,
    );
  } else {
    add("stocking", "Stocking vs contracted", 55, 20, "Insufficient NGP contract data");
  }

  const overallScore =
    totalWeight > 0 ? Math.round(weighted / totalWeight) : null;

  const penroBaselineSurvivalPct =
    plot?.latest_survival_rate != null
      ? Math.round(Number(plot.latest_survival_rate) * 100)
      : plot?.third_year_survival_rate != null
        ? Math.round(Number(plot.third_year_survival_rate) * 100)
        : null;

  return {
    overallScore,
    grade:
      overallScore == null
        ? "unknown"
        : overallScore >= 85
          ? "high"
          : overallScore >= 70
            ? "moderate"
            : "low",
    penroBaselineSurvivalPct,
    siteCode: plot?.site_code ?? plot?.plot_code ?? null,
    seedlingsContracted: contracted ?? null,
    checks,
    source: "COMPLIANCE-TO-PENRONGP-DATA-BASE",
  };
}

export function averagePenroAccuracy(
  submissions: { penro_accuracy_score?: number | null }[],
): number | null {
  const scores = submissions
    .map((s) => s.penro_accuracy_score)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
