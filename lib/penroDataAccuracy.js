/**
 * Data accuracy vs DENR PENRO NGP reference (CENRO Culasi compliance database).
 * Baselines: site code, contracted seedlings, species list, latest survival rate, reference GPS.
 */

const CULASI_LAT = 11.2886;
const CULASI_LON = 122.034;

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Normalize species token for fuzzy match against NGP contract list. */
export function normalizeSpeciesToken(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/mahogany|gmelina|ipilipil/g, (m) => m);
}

export function speciesListedInContract(commonName, speciesPlantedText) {
  if (!commonName || !speciesPlantedText) return null;
  const needle = normalizeSpeciesToken(commonName);
  if (!needle) return null;
  const tokens = String(speciesPlantedText)
    .split(/[,;/]+/)
    .map((t) => normalizeSpeciesToken(t))
    .filter(Boolean);
  return tokens.some(
    (t) => t.includes(needle) || needle.includes(t) || t.slice(0, 4) === needle.slice(0, 4),
  );
}

/**
 * @param {object} plot - reforestation_plots row with PENRO fields
 * @param {object} params - capture context
 */
export function computePenroDataAccuracy(plot, params) {
  const {
    latitude,
    longitude,
    seedling,
    estimatedSeedlings,
    accuracyMeters = null,
    plotSelected = false,
    sceneAreaSqM = null,
  } = params;

  const checks = [];
  let weighted = 0;
  let totalWeight = 0;

  const add = (id, label, score, weight, detail) => {
    checks.push({ id, label, score, weight, detail });
    weighted += score * weight;
    totalWeight += weight;
  };

  // 1. NGP site linkage (20)
  if (plot?.site_code || plot?.plot_code) {
    add(
      "site_code",
      "NGP site code",
      plotSelected ? 100 : 70,
      20,
      plotSelected
        ? `Linked to ${plot.site_code ?? plot.plot_code}`
        : "Reference plot available; assign on capture",
    );
  } else {
    add("site_code", "NGP site code", 0, 20, "No PENRO site on record");
  }

  // 2. GPS vs reference centroid (25)
  const refLat = plot?.latitude ?? CULASI_LAT;
  const refLon = plot?.longitude ?? CULASI_LON;
  if (typeof latitude === "number" && typeof longitude === "number") {
    const dist = haversineMeters(latitude, longitude, refLat, refLon);
    let gpsScore = 30;
    if (dist <= 50) gpsScore = 100;
    else if (dist <= 150) gpsScore = 85;
    else if (dist <= 500) gpsScore = 65;
    else if (dist <= 2000) gpsScore = 40;
    add(
      "gps_position",
      "GPS vs NGP reference",
      gpsScore,
      25,
      `${Math.round(dist)} m from site reference`,
    );
  } else {
    add("gps_position", "GPS vs NGP reference", 0, 25, "No GPS coordinates");
  }

  // 3. Device GPS precision (15)
  if (accuracyMeters != null) {
    let prec = 50;
    if (accuracyMeters <= 10) prec = 100;
    else if (accuracyMeters <= 20) prec = 90;
    else if (accuracyMeters <= 50) prec = 75;
    else if (accuracyMeters <= 100) prec = 55;
    add(
      "gps_precision",
      "GPS precision",
      prec,
      15,
      `±${Math.round(accuracyMeters)} m reported`,
    );
  } else {
    add("gps_precision", "GPS precision", 60, 15, "Precision not reported (survey fallback)");
  }

  // 4. Species vs contract (20)
  const listed = speciesListedInContract(
    seedling?.commonName,
    plot?.species_planted,
  );
  if (listed === true) {
    add("species", "Species vs NGP contract", 100, 20, `${seedling.commonName} listed in PENRO record`);
  } else if (listed === false) {
    add(
      "species",
      "Species vs NGP contract",
      35,
      20,
      `${seedling?.commonName ?? "Species"} not found in contracted mix`,
    );
  } else {
    add("species", "Species vs NGP contract", 50, 20, "Cannot verify species against contract");
  }

  // 5. Stocking vs contracted density (20)
  const contracted = plot?.seedlings_contracted ?? plot?.target_seedlings;
  const areaHa = plot?.area_ha;
  if (
    contracted &&
    areaHa &&
    areaHa > 0 &&
    typeof estimatedSeedlings === "number" &&
    estimatedSeedlings > 0
  ) {
    const refDensity = contracted / areaHa;
    let fieldHa = sceneAreaSqM > 0 ? sceneAreaSqM / 10000 : null;
    if (!fieldHa || fieldHa < 0.0001) fieldHa = 0.04;
    const fieldDensity = estimatedSeedlings / fieldHa;
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
    add("stocking", "Stocking vs contracted", 55, 20, "Insufficient NGP area/contract data");
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
