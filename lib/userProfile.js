import { supabase } from "./supabase";

const ROLE_LABELS = {
  forest_ranger: "Forest Ranger",
  planning_officer: "Planning Officer",
  admin: "Administrator",
  client: "Field officer",
};

export function roleDisplayLabel(role) {
  if (!role) return ROLE_LABELS.client;
  return ROLE_LABELS[role] ?? ROLE_LABELS.client;
}

/**
 * Load profile role + name for DENR-CENRO field dashboards.
 */
export async function fetchCurrentUserProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user?.id) {
    return { displayName: "Field officer", roleLabel: ROLE_LABELS.client, role: null };
  }

  const meta = user.user_metadata ?? {};
  const fallbackName =
    meta.full_name?.trim() || user.email?.split("@")[0] || "Field officer";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || fallbackName;
  const role = profile?.role ?? "client";

  return {
    displayName,
    role,
    roleLabel: roleDisplayLabel(role),
  };
}
