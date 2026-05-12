import { getSupabase, isSupabaseConfigured } from "./supabase";

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
  return (data ?? []) as MonitoringRow[];
}
