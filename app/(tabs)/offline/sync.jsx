import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../../lib/theme";

const CONFLICTS = [
  "GPS mismatch — Tibiao Plot A3",
  "Different counts — Culasi B1",
];

const HISTORY = [
  { place: "Libertad · Plot A1", status: "Uploaded", ok: true },
  { place: "Tibiao · Plot A3", status: "Conflict", ok: false },
];

export default function DataSyncScreen() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/offline");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.accent} />
        </TouchableOpacity>
        <View style={styles.subHeaderText}>
          <Text style={styles.title}>Data sync</Text>
          <Text style={styles.subtitle}>Uploading to server...</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Syncing pending reports</Text>
          <Text style={styles.syncCaption}>Network detected — 3 reports uploading</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressLabel}>60% · Report 2 of 3</Text>
        </View>

        <TouchableOpacity style={styles.btnSolid} activeOpacity={0.9}>
          <Text style={styles.btnSolidText}>Manual sync</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} activeOpacity={0.9}>
          <Text style={styles.btnOutlineText}>View all pending (3)</Text>
        </TouchableOpacity>

        <View style={styles.conflictCard}>
          <Text style={styles.conflictTitle}>Conflicts detected</Text>
          {CONFLICTS.map((line) => (
            <Text key={line} style={styles.conflictBullet}>
              • {line}
            </Text>
          ))}
          <View style={styles.conflictActions}>
            <TouchableOpacity style={styles.acceptLocal}>
              <Text style={styles.acceptLocalText}>Accept local</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectRetry}>
              <Text style={styles.rejectRetryText}>Reject & retry</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.historyHeading}>Recent activity</Text>
        {HISTORY.map((h) => (
          <View key={h.place} style={styles.historyRow}>
            <View style={[styles.statusDot, h.ok ? styles.dotOk : styles.dotWarn]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.historyPlace}>{h.place}</Text>
              <Text style={styles.historyStatus}>{h.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  subHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: { padding: 6, marginTop: 2 },
  subHeaderText: { flex: 1 },
  title: { color: theme.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: theme.accent, fontSize: 13, fontWeight: "600", marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  syncCard: {
    backgroundColor: theme.accentSurface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.accentDark,
    padding: 16,
    marginBottom: 14,
  },
  syncTitle: { color: theme.text, fontWeight: "800", fontSize: 16 },
  syncCaption: { color: theme.text, opacity: 0.85, fontSize: 13, marginTop: 6, fontWeight: "600" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { width: "60%", height: "100%", backgroundColor: theme.accentDark },
  progressLabel: { color: theme.text, fontWeight: "700", fontSize: 12, marginTop: 8 },
  btnSolid: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnSolidText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  btnOutline: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.text,
    marginBottom: 18,
  },
  btnOutlineText: { color: theme.text, fontWeight: "800", fontSize: 14 },
  conflictCard: {
    backgroundColor: theme.orangeMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.orange,
    padding: 16,
    marginBottom: 20,
  },
  conflictTitle: { color: theme.orange, fontWeight: "800", fontSize: 15, marginBottom: 8 },
  conflictBullet: { color: theme.text, fontSize: 13, marginBottom: 4, fontWeight: "600" },
  conflictActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  acceptLocal: {
    flex: 1,
    backgroundColor: "rgba(200, 230, 201, 0.25)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.accent,
  },
  acceptLocalText: { color: theme.accent, fontWeight: "800", fontSize: 12 },
  rejectRetry: {
    flex: 1,
    backgroundColor: "rgba(229, 115, 115, 0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.danger,
  },
  rejectRetryText: { color: theme.danger, fontWeight: "800", fontSize: 12 },
  historyHeading: {
    color: theme.textMuted,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: { backgroundColor: theme.accentDark },
  dotWarn: { backgroundColor: theme.orange },
  historyPlace: { color: theme.text, fontWeight: "700", fontSize: 14 },
  historyStatus: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
});
