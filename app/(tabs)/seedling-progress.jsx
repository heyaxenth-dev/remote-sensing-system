import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchReforestationPlots } from "../../lib/reforestationPlots";
import {
  compareSurvivalToPenro,
  fieldSurvivalPercentFromStatus,
  healthLabelFromStatus,
} from "../../lib/survivalMonitoring";
import { supabase } from "../../lib/supabase";
import { theme } from "../../lib/theme";

const STATUSES = ["planned", "planted", "growing", "monitored"];

function healthTone(label) {
  if (label === "healthy") return styles.healthHealthy;
  if (label === "at_risk") return styles.healthAtRisk;
  return styles.healthPending;
}

export default function SeedlingProgressScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]);
  const [plotsById, setPlotsById] = React.useState({});
  const [draftNotes, setDraftNotes] = React.useState({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      const [plotList, progressRes] = await Promise.all([
        fetchReforestationPlots().catch(() => []),
        uid
          ? supabase
              .from("seedling_progress")
              .select("*")
              .eq("user_id", uid)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const map = {};
      (plotList ?? []).forEach((p) => {
        map[p.id] = p;
      });
      setPlotsById(map);

      if (progressRes.error) throw progressRes.error;
      setRows(progressRes.data ?? []);
      const notes = {};
      (progressRes.data ?? []).forEach((r) => {
        notes[r.id] = r.notes ?? "";
      });
      setDraftNotes(notes);
    } catch (e) {
      console.warn(e);
      Alert.alert("Progress", e?.message ?? "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const cycleStatus = async (row) => {
    const i = STATUSES.indexOf(row.status);
    const next = STATUSES[(i + 1) % STATUSES.length];
    try {
      const { error } = await supabase
        .from("seedling_progress")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      await load();
    } catch (e) {
      Alert.alert("Update failed", e?.message ?? "");
    }
  };

  const saveNotes = async (row) => {
    const notes = draftNotes[row.id] ?? "";
    try {
      const { error } = await supabase
        .from("seedling_progress")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      Alert.alert("Saved", "Notes updated.");
      await load();
    } catch (e) {
      Alert.alert("Save failed", e?.message ?? "");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        {router.canGoBack() ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.title}>Survival & health</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>
            Monitor seedling survival rates and health trends. Field status is compared to
            PENRO NGP baseline survival for each site.
          </Text>

          {!rows.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No seedlings tracked yet. Capture an aerial view of a plantable area, confirm a
                species, then update status here as you monitor survival.
              </Text>
            </View>
          ) : null}

          {rows.map((row) => {
            const plot = row.plot_id ? plotsById[row.plot_id] : null;
            const fieldPct = fieldSurvivalPercentFromStatus(row.status);
            const penroRate = plot?.latest_survival_rate;
            const comparison = compareSurvivalToPenro(
              fieldPct,
              typeof penroRate === "number" ? penroRate : null,
            );
            const health = healthLabelFromStatus(row.status);

            return (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.common_name || row.seedling_id}</Text>
                {row.scientific_name ? (
                  <Text style={styles.cardSci}>{row.scientific_name}</Text>
                ) : null}
                {plot ? (
                  <Text style={styles.plotRef}>
                    NGP {plot.site_code ?? plot.plot_code}
                    {penroRate != null
                      ? ` · PENRO survival ${Math.round(Number(penroRate) * 100)}%`
                      : ""}
                  </Text>
                ) : null}

                <View style={styles.survivalRow}>
                  <View style={styles.survivalBox}>
                    <Text style={styles.survivalLabel}>Field survival (est.)</Text>
                    <Text style={styles.survivalValue}>
                      {fieldPct != null ? `${fieldPct}%` : "—"}
                    </Text>
                  </View>
                  <View style={styles.survivalBox}>
                    <Text style={styles.survivalLabel}>Health trend</Text>
                    <Text style={[styles.healthBadge, healthTone(health)]}>
                      {health === "healthy"
                        ? "Healthy"
                        : health === "at_risk"
                          ? "At risk"
                          : "Planned"}
                    </Text>
                  </View>
                </View>
                {comparison.deltaPct != null ? (
                  <Text style={styles.trendLine}>{comparison.label}</Text>
                ) : null}

                <TouchableOpacity style={styles.statusBtn} onPress={() => cycleStatus(row)}>
                  <Text style={styles.statusLabel}>Monitoring status</Text>
                  <Text style={styles.statusValue}>{row.status}</Text>
                  <Text style={styles.statusHint}>Tap to cycle · tracks survival trend</Text>
                </TouchableOpacity>

                <Text style={styles.notesLabel}>Field observations</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  placeholder="Mortality, pests, watering, canopy change…"
                  placeholderTextColor={theme.textMuted}
                  value={draftNotes[row.id] ?? ""}
                  onChangeText={(t) =>
                    setDraftNotes((prev) => ({ ...prev, [row.id]: t }))
                  }
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => saveNotes(row)}>
                  <Text style={styles.saveBtnText}>Save notes</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  headerSpacer: { width: 42 },
  title: {
    flex: 1,
    textAlign: "center",
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  lead: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  empty: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  emptyText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  cardSci: {
    color: theme.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 2,
  },
  plotRef: {
    color: theme.accentDark,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 10,
  },
  survivalRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  survivalBox: {
    flex: 1,
    backgroundColor: theme.accentSurface,
    borderRadius: 12,
    padding: 10,
  },
  survivalLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "700" },
  survivalValue: {
    color: theme.accentDark,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  healthBadge: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  healthHealthy: { backgroundColor: "#C8E6C9", color: "#1B5E20" },
  healthAtRisk: { backgroundColor: "#FFE0B2", color: "#E65100" },
  healthPending: { backgroundColor: "#E0E0E0", color: "#424242" },
  trendLine: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: 10,
    fontStyle: "italic",
  },
  statusBtn: {
    backgroundColor: theme.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700" },
  statusValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    textTransform: "capitalize",
    marginTop: 4,
  },
  statusHint: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  notesLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  notesInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 10,
    color: theme.text,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  saveBtn: {
    alignSelf: "flex-start",
    backgroundColor: theme.accentDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: theme.text, fontWeight: "800", fontSize: 13 },
});
