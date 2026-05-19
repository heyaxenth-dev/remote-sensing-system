#!/usr/bin/env node
/**
 * Import NGP sites from data/ngp-penro-reference.json into Supabase reforestation_plots.
 *
 * Requires: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 *   node scripts/import-ngp-sites.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const url =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env",
  );
  process.exit(1);
}

const ref = JSON.parse(
  readFileSync(join(root, "data/ngp-penro-reference.json"), "utf8"),
);

const supabase = createClient(url, key);

const rows = ref.sites.map((s) => ({
  plot_code: s.site_code,
  site_code: s.site_code,
  name: s.po_name || s.site_code,
  po_name: s.po_name,
  representative: s.representative,
  location_text: s.location,
  barangay: s.barangay,
  municipality: s.municipality || "Antique",
  latitude: s.latitude,
  longitude: s.longitude,
  target_seedlings: s.seedlings_contracted ?? 0,
  seedlings_contracted: s.seedlings_contracted,
  area_ha: s.area_ha,
  species_planted: s.species_planted,
  program_year: s.program_year,
  contract_expiry: s.contract_expiry || null,
  third_year_survival_rate: s.third_year_survival_rate,
  latest_survival_rate: s.latest_survival_rate,
  penro_source: ref.source,
}));

console.log(`Upserting ${rows.length} NGP sites…`);

const chunkSize = 50;
let ok = 0;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase
    .from("reforestation_plots")
    .upsert(chunk, { onConflict: "plot_code" });
  if (error) {
    console.error("Chunk failed:", error.message);
    process.exit(1);
  }
  ok += chunk.length;
  console.log(`  ${ok}/${rows.length}`);
}

console.log("Done. PENRO NGP reference imported.");
