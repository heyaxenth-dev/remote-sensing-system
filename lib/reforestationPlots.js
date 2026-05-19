import { supabase } from "./supabase";

/**
 * Load registered reforestation plots for plot picker (central geospatial registry).
 */
const PENRO_SELECT =
  "id, plot_code, site_code, name, po_name, barangay, municipality, latitude, longitude, target_seedlings, seedlings_contracted, area_ha, species_planted, latest_survival_rate, third_year_survival_rate, program_year";

export async function fetchReforestationPlots() {
  const { data, error } = await supabase
    .from("reforestation_plots")
    .select(PENRO_SELECT)
    .order("plot_code", { ascending: true });

  if (error) throw error;
  if (data?.length) return data;

  return loadPenroPlotsFromBundle();
}

/** Fallback when Supabase has not been seeded with PENRO import yet. */
export function loadPenroPlotsFromBundle() {
  try {
    const ref = require("../data/ngp-penro-reference.json");
    return (ref.sites ?? []).map((s) => ({
      id: s.site_code,
      plot_code: s.site_code,
      site_code: s.site_code,
      name: s.po_name || s.site_code,
      po_name: s.po_name,
      barangay: s.barangay,
      municipality: s.municipality,
      latitude: s.latitude,
      longitude: s.longitude,
      target_seedlings: s.seedlings_contracted ?? 0,
      seedlings_contracted: s.seedlings_contracted,
      area_ha: s.area_ha,
      species_planted: s.species_planted,
      latest_survival_rate: s.latest_survival_rate,
      third_year_survival_rate: s.third_year_survival_rate,
      program_year: s.program_year,
    }));
  } catch {
    return [];
  }
}
