import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { analyzeSeedlingCapture } from "../../lib/analyzeCapture";
import { theme } from "../../lib/theme";

const GRID_LABELS = ["S1", "S2", "?", null, null, null, null, null, null];

/** Placeholder until GPS is wired; keep in sync with the GPS bar for consistent analysis context. */
const CAPTURE_LATITUDE = 11.2886;
const CAPTURE_LONGITUDE = 122.034;

export default function CaptureScreen() {
  const [gridOn, setGridOn] = React.useState(true);
  const [aiOn, setAiOn] = React.useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraGranted = permission?.granted === true;
  const cameraRef = React.useRef(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState(null);

  const handleCapturePress = React.useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Capture",
        "Camera capture runs on iOS and Android builds, not in the web preview.",
      );
      return;
    }
    if (!cameraGranted) {
      Alert.alert("Camera", "Allow camera access first.");
      return;
    }
    if (!aiOn) {
      Alert.alert(
        "AI detect off",
        "Turn on “AI detect” to get a seedling recommendation from the scene.",
      );
      return;
    }
    const cam = cameraRef.current;
    if (!cam?.takePictureAsync) {
      Alert.alert("Camera", "Preview is not ready yet.");
      return;
    }

    setAnalyzing(true);
    setRecommendation(null);
    try {
      const photo = await cam.takePictureAsync({
        quality: 0.55,
        base64: true,
      });
      if (!photo?.base64) {
        throw new Error("Camera returned no image data.");
      }
      const result = await analyzeSeedlingCapture({
        base64: photo.base64,
        latitude: CAPTURE_LATITUDE,
        longitude: CAPTURE_LONGITUDE,
      });
      setRecommendation(result);
    } catch (e) {
      const message = e?.message || "Something went wrong.";
      Alert.alert("Capture & analyze", message);
    } finally {
      setAnalyzing(false);
    }
  }, [aiOn, cameraGranted]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
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
          <View style={styles.mapCardStack}>
            {cameraGranted ? (
              <CameraView
                ref={cameraRef}
                style={styles.cameraPreview}
                facing="back"
                mode="picture"
              />
            ) : null}
            <View
              style={[styles.gridWrap, !gridOn && styles.gridHidden]}
              pointerEvents={gridOn ? "auto" : "none"}
            >
              {GRID_LABELS.map((label, index) => {
                const isCenter = index === 4;

                return (
                  <View
                    key={index}
                    style={[
                      styles.gridCell,
                      isCenter && styles.gridCellCenter,
                      cameraGranted &&
                        (isCenter
                          ? styles.gridCellCenterOverCamera
                          : styles.gridCellOverCamera),
                    ]}
                  >
                    {isCenter && (
                      <View style={styles.crosshair}>
                        <View style={styles.crossV} />
                        <View style={styles.crossH} />
                      </View>
                    )}

                    {label && (
                      <Text
                        style={[
                          styles.gridLabel,
                          isCenter && styles.gridLabelCenter,
                        ]}
                      >
                        {label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {!cameraGranted ? (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
              disabled={
                !permission?.canAskAgain && permission?.status === "denied"
              }
            >
              <Text style={styles.permissionBtnText}>
                {permission?.status === "denied" && !permission?.canAskAgain
                  ? "Camera blocked — enable in Settings"
                  : "Request camera permission"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.captureBtn,
            (!cameraGranted || analyzing || !aiOn) && styles.captureBtnDisabled,
          ]}
          activeOpacity={0.9}
          onPress={handleCapturePress}
          disabled={!cameraGranted || analyzing || !aiOn}
        >
          <View style={styles.captureInner}>
            {analyzing ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <View style={styles.captureRing}>
                <View style={styles.captureDot} />
              </View>
            )}
            <Text style={styles.captureText}>
              {analyzing ? "Analyzing scene…" : "Capture & tag"}
            </Text>
          </View>
        </TouchableOpacity>

        {recommendation?.recommended ? (
          <View style={styles.recoCard}>
            <Text style={styles.recoHeading}>Recommended seedling</Text>
            <Text style={styles.recoTitle}>
              {recommendation.recommended.commonName}
            </Text>
            <Text style={styles.recoSci}>
              {recommendation.recommended.scientificName}
            </Text>
            <Text style={styles.recoNotes}>
              {recommendation.recommended.notes}
            </Text>
            <Text style={styles.recoMeta}>
              Confidence{" "}
              {Math.round((recommendation.confidence ?? 0) * 100)}% · source{" "}
              {recommendation.source === "remote" ? "server" : "on-device"}
            </Text>
            <Text style={styles.recoRationale}>{recommendation.rationale}</Text>
            {recommendation.alternatives?.length ? (
              <View style={styles.altRow}>
                <Text style={styles.altLabel}>Also consider: </Text>
                <Text style={styles.altText}>
                  {recommendation.alternatives
                    .map((a) => a.commonName)
                    .join(" · ")}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

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
  subtitle: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
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
    overflow: "hidden",
  },
  mapCardStack: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    zIndex: 1,
  },
  gridHidden: {
    opacity: 0,
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
  gridCellOverCamera: {
    backgroundColor: "rgba(74, 74, 74, 0.4)",
  },
  gridCellCenterOverCamera: {
    backgroundColor: "rgba(200, 230, 201, 0.28)",
  },
  permissionBtn: { marginTop: 12, alignSelf: "center", paddingVertical: 4 },
  permissionBtnText: { color: theme.accent, fontWeight: "700" },
  gridLabel: { color: theme.textMuted, fontWeight: "700", fontSize: 12 },
  gridLabelCenter: { color: theme.text },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
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
  captureBtnDisabled: {
    opacity: 0.55,
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
  recoCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  recoHeading: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  recoTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
  },
  recoSci: {
    color: theme.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 10,
  },
  recoNotes: { color: theme.text, fontSize: 14, lineHeight: 20 },
  recoMeta: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
  },
  recoRationale: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  altRow: { marginTop: 12 },
  altLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  altText: { color: theme.text, fontSize: 13, marginTop: 4, lineHeight: 18 },
  panel: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  panelHeading: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
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
  kpiNeutral: {
    backgroundColor: theme.bgCard,
    borderWidth: 1,
    borderColor: theme.border,
  },
  kpiTextDark: { color: theme.accentDark, fontWeight: "800", fontSize: 11 },
  kpiTextLight: { color: theme.text, fontWeight: "800", fontSize: 11 },
});
