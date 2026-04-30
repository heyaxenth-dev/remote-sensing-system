import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../lib/theme";

const GRID_LABELS = ["S1", "S2", "?", null, null, null, null, null, null];

export default function CaptureScreen() {
  const [gridOn, setGridOn] = React.useState(true);
  const [aiOn, setAiOn] = React.useState(true);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Data capture</Text>
            <Text style={styles.subtitle}>Mobile data acquisition</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="scan-outline" size={26} color={theme.accent} />
          </View>
        </View>

        <View style={styles.gpsBar}>
          <Text style={styles.gpsBarLeft}>GPS location</Text>
          <Text style={styles.gpsBarRight}>11.2886°N 122.034°E</Text>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.gridWrap}>
            {Array.from({ length: 9 }).map((_, i) => {
              const label = GRID_LABELS[i];
              const center = i === 4;
              return (
                <View key={i} style={[styles.gridCell, center && styles.gridCellCenter]}>
                  {label ? (
                    <Text style={[styles.gridLabel, center && styles.gridLabelCenter]}>{label}</Text>
                  ) : null}
                  {center ? (
                    <View style={styles.crosshair}>
                      <View style={styles.crossV} />
                      <View style={styles.crossH} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.captureBtn} activeOpacity={0.9}>
          <View style={styles.captureInner}>
            <View style={styles.captureRing}>
              <View style={styles.captureDot} />
            </View>
            <Text style={styles.captureText}>Capture & tag</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.panel}>
          <Text style={styles.panelHeading}>Tools</Text>
          <View style={styles.toolsRow}>
            <TouchableOpacity>
              <Text style={styles.toolAdd}>+ Add seedling</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.toolRemove}>− Remove</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.panelHeading, { marginTop: 16 }]}>Layers</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Grid</Text>
            <Switch
              value={gridOn}
              onValueChange={setGridOn}
              trackColor={{ false: theme.border, true: theme.accentDark }}
              thumbColor={gridOn ? theme.accent : theme.textMuted}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>AI detect</Text>
            <Switch
              value={aiOn}
              onValueChange={setAiOn}
              trackColor={{ false: theme.border, true: theme.accentDark }}
              thumbColor={aiOn ? theme.accent : theme.textMuted}
            />
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, styles.kpiOk]}>
            <Text style={styles.kpiTextDark}>2 Verified</Text>
          </View>
          <View style={[styles.kpi, styles.kpiWarn]}>
            <Text style={styles.kpiTextDark}>1 Low conf.</Text>
          </View>
          <View style={[styles.kpi, styles.kpiNeutral]}>
            <Text style={styles.kpiTextLight}>5/45 Progress</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 8,
    marginBottom: 16,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: theme.accent, fontSize: 13, fontWeight: "600", marginTop: 4 },
  headerIcon: { padding: 4 },
  gpsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.accentDark,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  gpsBarLeft: { color: theme.accentSurface, fontWeight: "700", fontSize: 13 },
  gpsBarRight: { color: theme.text, fontWeight: "600", fontSize: 12 },
  mapCard: {
    backgroundColor: "#3A3A3A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
    marginBottom: 16,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  gridCell: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "#4A4A4A",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  gridCellCenter: {
    backgroundColor: "rgba(200, 230, 201, 0.35)",
    borderWidth: 1,
    borderColor: theme.accent,
  },
  gridLabel: { color: theme.textMuted, fontWeight: "700", fontSize: 12 },
  gridLabelCenter: { color: theme.text },
  crosshair: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  crossV: {
    position: "absolute",
    width: 2,
    height: "70%",
    backgroundColor: theme.text,
    opacity: 0.9,
  },
  crossH: {
    position: "absolute",
    height: 2,
    width: "70%",
    backgroundColor: theme.text,
    opacity: 0.9,
  },
  captureBtn: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.text,
    backgroundColor: theme.bgCard,
    marginBottom: 16,
  },
  captureInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 14,
  },
  captureRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.text,
    alignItems: "center",
    justifyContent: "center",
  },
  captureDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.text,
  },
  captureText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  panel: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  panelHeading: { color: theme.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 10 },
  toolsRow: { flexDirection: "row", justifyContent: "space-between" },
  toolAdd: { color: theme.accent, fontWeight: "700", fontSize: 14 },
  toolRemove: { color: theme.text, fontWeight: "700", fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  toggleLabel: { color: theme.text, fontWeight: "600", fontSize: 14 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  kpiOk: { backgroundColor: theme.accentSurface },
  kpiWarn: { backgroundColor: "#FFCC80" },
  kpiNeutral: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border },
  kpiTextDark: { color: theme.accentDark, fontWeight: "800", fontSize: 11 },
  kpiTextLight: { color: theme.text, fontWeight: "800", fontSize: 11 },
});
