import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../../lib/theme";

const PENDING = [
  { id: "a", place: "Location A", date: "March 20, 2025 · 10:34 AM" },
  { id: "b", place: "Location B", date: "March 21, 2025 · 3:40 PM" },
  { id: "c", place: "Location C", date: "March 22, 2025 · 2:30 PM" },
];

export default function OfflineStorageScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.subHeader}>
        <View>
          <Text style={styles.headline}>Offline storage</Text>
          <Text style={styles.subtitle}>Offline operation & storage</Text>
        </View>
        <View style={styles.offlineTag}>
          <Text style={styles.offlineTagText}>Offline</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Pending reports</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3 pending</Text>
            </View>
          </View>

          {PENDING.map((row, idx) => (
            <TouchableOpacity
              key={row.id}
              style={[styles.listRow, idx === 0 && styles.listRowFirst]}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Site metrics: {row.place}</Text>
                <Text style={styles.rowMeta}>{row.date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Save locally</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Will auto-sync when network is available.</Text>

        <TouchableOpacity onPress={() => router.push("/offline/sync")} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>Go to data sync →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headline: { color: theme.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: theme.accent, fontSize: 13, fontWeight: "600", marginTop: 4 },
  offlineTag: {
    backgroundColor: theme.orangeMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.orange,
  },
  offlineTagText: { color: theme.orange, fontWeight: "800", fontSize: 11 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { color: theme.text, fontWeight: "800", fontSize: 15 },
  badge: {
    backgroundColor: theme.orangeMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: theme.orange, fontSize: 11, fontWeight: "800" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  listRowFirst: {
    borderTopWidth: 0,
  },
  rowTitle: { color: theme.text, fontWeight: "700", fontSize: 14 },
  rowMeta: { color: theme.textMuted, fontSize: 12, marginTop: 4 },
  primaryBtn: {
    backgroundColor: theme.bgElevated,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.text,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  hint: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  secondaryLink: { marginTop: 20, alignItems: "center" },
  secondaryLinkText: { color: theme.accent, fontWeight: "700", fontSize: 14 },
});
