import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { analyzeSeedlingCapture } from "../../lib/analyzeCapture";
import { SURVEY_LATITUDE, SURVEY_LONGITUDE } from "../../lib/surveyLocation";
import { supabase } from "../../lib/supabase";
import { theme } from "../../lib/theme";

const GRID_LABELS = ["S1", "S2", "?", null, null, null, null, null, null];

export default function CaptureScreen() {
  const router = useRouter();
  const [gridOn, setGridOn] = React.useState(true);
  const [aiOn, setAiOn] = React.useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraGranted = permission?.granted === true;
  const cameraRef = React.useRef(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState(null);
  const [selectedSeedlingId, setSelectedSeedlingId] = React.useState(null);

  const selectedRankRow = React.useMemo(() => {
    if (!recommendation?.rankedSeedlings?.length) return null;
    const found = recommendation.rankedSeedlings.find(
      (r) => r.seedling.id === selectedSeedlingId,
    );
    return found ?? recommendation.rankedSeedlings[0];
  }, [recommendation, selectedSeedlingId]);

  React.useEffect(() => {
    if (recommendation?.recommended?.id) {
      setSelectedSeedlingId(recommendation.recommended.id);
    } else {
      setSelectedSeedlingId(null);
    }
  }, [recommendation]);

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
        latitude: SURVEY_LATITUDE,
        longitude: SURVEY_LONGITUDE,
      });
      setRecommendation(result);
    } catch (e) {
      const message = e?.message || "Something went wrong.";
      Alert.alert("Capture & analyze", message);
    } finally {
      setAnalyzing(false);
    }
  }, [aiOn, cameraGranted]);

  const monitorSeedling = React.useCallback(
    async (seedling) => {
      if (!seedling?.id) return;
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session?.user?.id) {
          Alert.alert("Sign in required", "Log in to save seedling progress.");
          return;
        }
        const { data, error } = await supabase
          .from("seedling_progress")
          .insert({
            user_id: session.user.id,
            seedling_id: seedling.id,
            common_name: seedling.commonName ?? null,
            scientific_name: seedling.scientificName ?? null,
            status: "planned",
            notes: "",
          })
          .select("id")
          .single();
        if (error) throw error;
        if (!data?.id) {
          throw new Error(
            "Insert did not return a row. Check Supabase URL, policies, and network.",
          );
        }
        router.push("/seedling-progress");
      } catch (e) {
        Alert.alert("Could not save", e?.message ?? "Try again.");
      }
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
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
          <Text style={styles.gpsBarRight}>
            {SURVEY_LATITUDE.toFixed(4)}°N {SURVEY_LONGITUDE.toFixed(4)}°E
          </Text>
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

        {recommendation?.unsuitableForPlanting ? (
          <View style={[styles.recoCard, styles.warnCard]}>
            <Text style={styles.warnHeading}>Not a plantable surface</Text>
            <Text style={styles.warnBody}>
              {recommendation.unsuitableReason ||
                recommendation.rationale ||
                "This scene appears dominated by concrete or hardscape. Capture soil or vegetation to get seedling recommendations."}
            </Text>
          </View>
        ) : null}

        {!recommendation?.unsuitableForPlanting &&
        recommendation?.rankedSeedlings?.length ? (
          <>
            <View style={styles.rankCard}>
              <Text style={styles.rankHeading}>Candidates (tap to select)</Text>
              <Text style={styles.candidatesHint}>
                Source:{" "}
                {recommendation.source === "remote" ? "server" : "on-device"}
              </Text>
              {recommendation.rankedSeedlings.map((row) => {
                const selected = row.seedling.id === selectedSeedlingId;
                return (
                  <TouchableOpacity
                    key={row.seedling.id}
                    style={[styles.rankRow, selected && styles.rankRowSelected]}
                    onPress={() => setSelectedSeedlingId(row.seedling.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.rankName}>
                      {row.seedling.commonName}
                      {row.seedling.id === recommendation.recommended?.id
                        ? " · top match"
                        : ""}
                    </Text>
                    <Text style={styles.rankPct}>{row.matchPercent}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedRankRow ? (
              <View style={styles.recoCard}>
                <Text style={styles.recoHeading}>Selected seedling</Text>
                <Text style={styles.recoTitle}>
                  {selectedRankRow.seedling.commonName}
                </Text>
                <Text style={styles.recoSci}>
                  {selectedRankRow.seedling.scientificName}
                </Text>
                <Text style={styles.recoNotes}>
                  {selectedRankRow.seedling.notes}
                </Text>
                <Text style={styles.recoMeta}>
                  Match {selectedRankRow.matchPercent}%
                  {selectedRankRow.seedling.id === recommendation.recommended?.id
                    ? ` · confidence ${Math.round(
                        (recommendation.confidence ?? 0) * 100,
                      )}%`
                    : ""}
                </Text>
                <Text style={styles.recoRationale}>{recommendation.rationale}</Text>
                <TouchableOpacity
                  style={styles.monitorBtn}
                  onPress={() => monitorSeedling(selectedRankRow.seedling)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.monitorBtnText}>Monitor this seedling</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : !recommendation?.unsuitableForPlanting &&
          recommendation?.recommended ? (
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
              Match score{" "}
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
            <TouchableOpacity
              style={styles.monitorBtn}
              onPress={() => monitorSeedling(recommendation.recommended)}
              activeOpacity={0.9}
            >
              <Text style={styles.monitorBtnText}>Monitor this seedling</Text>
            </TouchableOpacity>
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
  warnCard: {
    borderColor: theme.orange,
    backgroundColor: "rgba(255, 152, 0, 0.12)",
  },
  warnHeading: {
    color: theme.orange,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  warnBody: { color: theme.text, fontSize: 14, lineHeight: 20 },
  monitorBtn: {
    marginTop: 14,
    backgroundColor: theme.accentDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  monitorBtnText: { color: theme.text, fontWeight: "800", fontSize: 14 },
  rankCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  rankHeading: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  candidatesHint: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: 10,
  },
  rankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rankRowSelected: {
    backgroundColor: "rgba(129, 199, 132, 0.14)",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  rankName: { color: theme.text, fontWeight: "600", fontSize: 14, flex: 1 },
  rankPct: { color: theme.textMuted, fontWeight: "800", fontSize: 14 },
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
