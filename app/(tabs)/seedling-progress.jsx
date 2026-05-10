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
import { supabase } from "../../lib/supabase";
import { theme } from "../../lib/theme";

const STATUSES = ["planned", "planted", "growing", "monitored"];

export default function SeedlingProgressScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]);
  const [draftNotes, setDraftNotes] = React.useState({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setRows([]);
        return;
      }
      const { data, error } = await supabase
        .from("seedling_progress")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setRows(data ?? []);
      const map = {};
      (data ?? []).forEach((r) => {
        map[r.id] = r.notes ?? "";
      });
      setDraftNotes(map);
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
        <Text style={styles.title}>Seedling progress</Text>
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
            Track status and notes for seedlings you chose from recommendations.
          </Text>

          {!rows.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No seedlings tracked yet. Run a capture analysis and tap “Monitor
                this seedling”.
              </Text>
            </View>
          ) : null}

          {rows.map((row) => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.cardTitle}>{row.common_name || row.seedling_id}</Text>
              {row.scientific_name ? (
                <Text style={styles.cardSci}>{row.scientific_name}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.statusBtn}
                onPress={() => cycleStatus(row)}
              >
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={styles.statusValue}>{row.status}</Text>
                <Text style={styles.statusHint}>Tap to cycle</Text>
              </TouchableOpacity>

              <Text style={styles.notesLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                placeholder="Observations, watering, inspections…"
                placeholderTextColor={theme.textMuted}
                value={draftNotes[row.id] ?? ""}
                onChangeText={(t) =>
                  setDraftNotes((prev) => ({ ...prev, [row.id]: t }))
                }
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => saveNotes(row)}
              >
                <Text style={styles.saveBtnText}>Save notes</Text>
              </TouchableOpacity>
            </View>
          ))}
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
    marginBottom: 12,
  },
  statusBtn: {
    backgroundColor: theme.accentSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statusLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700" },
  statusValue: {
    color: theme.accentDark,
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
