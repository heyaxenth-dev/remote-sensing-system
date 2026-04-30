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

export default function OfflineMapScreen() {
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
        <View style={styles.subHeaderMain}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Offline map</Text>
            <Text style={styles.subtitle}>Map caching & navigation</Text>
          </View>
          <View style={styles.cachedTag}>
            <Text style={styles.cachedTagText}>Cached</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.mapWrap}>
          <View style={styles.mapBase}>
            <View style={[styles.zone, styles.zoneGreen]} />
            <View style={[styles.zone, styles.zoneOrange]} />
            <View style={[styles.pin, styles.pinRed]}>
              <View style={styles.pinInner} />
            </View>
          </View>
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.ctrlBtn}>
              <Text style={styles.ctrlText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn}>
              <Text style={styles.ctrlText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn}>
              <Ionicons name="locate" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBar}>
          <Text style={styles.infoLeft}>Cached area</Text>
          <Text style={styles.infoRight}>Kalibo region · 42 MB</Text>
        </View>

        <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.9}>
          <Text style={styles.downloadBtnText}>Download map area</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85}>
          <Text style={styles.clearBtnText}>Clear cache</Text>
        </TouchableOpacity>
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
  subHeaderMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    paddingRight: 8,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: theme.accent, fontSize: 13, fontWeight: "600", marginTop: 4 },
  cachedTag: {
    backgroundColor: "rgba(200, 230, 201, 0.2)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  cachedTagText: { color: theme.accent, fontWeight: "800", fontSize: 11 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  mapWrap: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 0,
  },
  mapBase: {
    flex: 1,
    backgroundColor: "#1B3D2F",
    alignItems: "center",
    justifyContent: "center",
  },
  zone: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.45,
  },
  zoneGreen: {
    width: 160,
    height: 160,
    backgroundColor: theme.accentDark,
    top: 24,
    left: 20,
  },
  zoneOrange: {
    width: 120,
    height: 120,
    backgroundColor: theme.orange,
    bottom: 28,
    right: 36,
  },
  pin: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.text,
  },
  pinRed: {
    backgroundColor: "#C62828",
    top: "42%",
    left: "48%",
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.text,
  },
  mapControls: {
    position: "absolute",
    right: 10,
    top: 10,
    gap: 8,
  },
  ctrlBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  ctrlText: { color: theme.text, fontSize: 18, fontWeight: "700" },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.border,
    marginBottom: 16,
  },
  infoLeft: { color: theme.textMuted, fontWeight: "700", fontSize: 13 },
  infoRight: { color: theme.accent, fontWeight: "800", fontSize: 13 },
  downloadBtn: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.text,
    backgroundColor: theme.bgCard,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  downloadBtnText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  clearBtn: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  clearBtnText: { color: theme.text, fontWeight: "700", fontSize: 14 },
});
