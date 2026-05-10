/**
 * Best-effort soil context from `public.soil_types` (bounding boxes).
 * Returns null if Supabase is unavailable or the table has no matching row.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} lat
 * @param {number} lon
 */
export async function fetchSoilProfileForLocation(supabase, lat, lon) {
  if (!supabase?.from) return null;
  const { data, error } = await supabase.from("soil_types").select("*");
  if (error || !Array.isArray(data) || !data.length) return null;

  const inside = data.filter(
    (r) =>
      lat >= r.lat_min &&
      lat <= r.lat_max &&
      lon >= r.lon_min &&
      lon <= r.lon_max,
  );
  if (!inside.length) return null;

  const bboxArea = (r) =>
    Math.abs(r.lat_max - r.lat_min) * Math.abs(r.lon_max - r.lon_min);
  inside.sort((a, b) => bboxArea(a) - bboxArea(b));
  const r = inside[0];
  const ph = Number(r.ph);
  if (!Number.isFinite(ph)) return null;

  return {
    ph,
    drainage: r.drainage,
    texture: r.texture,
    regionLabel: r.region_label,
  };
}
