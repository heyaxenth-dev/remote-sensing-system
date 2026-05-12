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
import { insertMonitorSeedlingSubmission } from "../../lib/monitoringSubmissions";
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
  const lastCaptureBase64Ref = React.useRef(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState(null);
  const [selectedSeedlingId, setSelectedSeedlingId] = React.useState(null);

  const displayRanked = React.useMemo(() => {
    if (!recommendation || recommendation.unsuitableForPlanting) return [];
    if (recommendation.rankedSeedlings?.length) {
      return recommendation.rankedSeedlings;
    }
    if (recommendation.recommended) {
      return [
        {
          seedling: recommendation.recommended,
          matchPercent: Math.round((recommendation.confidence ?? 0) * 100),
        },
      ];
    }
    return [];
  }, [recommendation]);

  const seedlingsNeededForArea = React.useMemo(() => {
    if (!recommendation || recommendation.unsuitableForPlanting) return null;
    const n = recommendation.estimatedSeedlingsNeeded;
    if (typeof n === "number" && !Number.isNaN(n)) {
      return Math.max(1, Math.round(n));
    }
    return null;
  }, [recommendation]);

  const selectedRankRow = React.useMemo(() => {
    if (!displayRanked.length) return null;
    const found = displayRanked.find((r) => r.seedling.id === selectedSeedlingId);
    return found ?? displayRanked[0];
  }, [displayRanked, selectedSeedlingId]);

  React.useEffect(() => {
    const firstId = displayRanked[0]?.seedling?.id;
    if (firstId) {
      setSelectedSeedlingId((prev) =>
        prev && displayRanked.some((r) => r.seedling.id === prev)
          ? prev
          : firstId,
      );
    } else {
      setSelectedSeedlingId(null);
    }
  }, [displayRanked]);

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
    lastCaptureBase64Ref.current = null;
    try {
      const photo = await cam.takePictureAsync({
        quality: 0.55,
        base64: true,
      });
      if (!photo?.base64) {
        throw new Error("Camera returned no image data.");
      }
      lastCaptureBase64Ref.current = photo.base64;
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
    async (seedling, recommendationSnapshot, selectedMatchPercent) => {
      if (!seedling?.id) return;
      const est = (() => {
        const n = recommendationSnapshot?.estimatedSeedlingsNeeded;
        if (typeof n === "number" && !Number.isNaN(n)) {
          return Math.max(1, Math.round(n));
        }
        return 1;
      })();
      const imageBase64 = lastCaptureBase64Ref.current;
      setSaving(true);
      try {
        await insertMonitorSeedlingSubmission({
          latitude: SURVEY_LATITUDE,
          longitude: SURVEY_LONGITUDE,
          seedling,
          recommendation: recommendationSnapshot,
          selectedMatchPercent,
          imageBase64: imageBase64 ?? null,
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const notesLine = `Estimated seedlings for captured area: ${est}.`;
          const { error } = await supabase.from("seedling_progress").insert({
            user_id: session.user.id,
            seedling_id: seedling.id,
            common_name: seedling.commonName ?? null,
            scientific_name: seedling.scientificName ?? null,
            status: "planned",
            notes: notesLine,
          });
          if (error) console.warn("[capture] seedling_progress:", error.message);
        }

        lastCaptureBase64Ref.current = null;
        router.push("/seedling-progress");
      } catch (e) {
        Alert.alert("Could not save", e?.message ?? "Try again.");
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  const promptConfirmSeedling = React.useCallback(
    (seedling, snapshot, matchPercent) => {
      if (!seedling?.id || !snapshot) return;
      const n = (() => {
        const v = snapshot.estimatedSeedlingsNeeded;
        if (typeof v === "number" && !Number.isNaN(v)) {
          return Math.max(1, Math.round(v));
        }
        return 1;
      })();
      Alert.alert(
        "Confirm seedling",
        `Add ${seedling.commonName ?? seedling.id} to your seedling progress?\n\n` +
          `Seedlings needed for this area (estimate): ${n}.\n` +
          `One admin record will be created with your capture image and confirmed species.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm & add",
            style: "default",
            onPress: () => monitorSeedling(seedling, snapshot, matchPercent),
          },
        ],
      );
    },
    [monitorSeedling],
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
            (!cameraGranted || analyzing || saving || !aiOn) && styles.captureBtnDisabled,
          ]}
          activeOpacity={0.9}
          onPress={handleCapturePress}
          disabled={!cameraGranted || analyzing || saving || !aiOn}
        >
          <View style={styles.captureInner}>
            {analyzing || saving ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <View style={styles.captureRing}>
                <View style={styles.captureDot} />
              </View>
            )}
            <Text style={styles.captureText}>
              {saving
                ? "Uploading & saving…"
                : analyzing
                  ? "Analyzing scene…"
                  : "Capture & tag"}
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
            <Text style={styles.warnFootnote}>
              This capture is not saved as a monitoring entry (concrete / hardscape
              is excluded by default).
            </Text>
          </View>
        ) : null}

        {!recommendation?.unsuitableForPlanting && displayRanked.length ? (
          <>
            {seedlingsNeededForArea != null ? (
              <View style={styles.areaNeedCard}>
                <Text style={styles.areaNeedLabel}>For this captured area</Text>
                <Text style={styles.areaNeedValue}>{seedlingsNeededForArea}</Text>
                <Text style={styles.areaNeedHint}>
                  Estimated seedlings needed (spacing heuristic from scene and
                  context). Nothing is sent to the server until you confirm below;
                  then one record is stored with this photo and your species choice.
                </Text>
              </View>
            ) : null}

            <View style={styles.rankCard}>
              <Text style={styles.rankHeading}>Recommended seedlings</Text>
              <Text style={styles.candidatesHint}>
                Tap a row to select · source{" "}
                {recommendation.source === "remote" ? "server" : "on-device"}
              </Text>
              {displayRanked.map((row) => {
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
                <Text style={styles.recoHeading}>Your selection</Text>
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
                    ? ` · model confidence ${Math.round(
                        (recommendation.confidence ?? 0) * 100,
                      )}%`
                    : ""}
                  {seedlingsNeededForArea != null
                    ? ` · seedlings for area: ${seedlingsNeededForArea}`
                    : ""}
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
                  style={[styles.monitorBtn, saving && styles.monitorBtnDisabled]}
                  onPress={() =>
                    promptConfirmSeedling(
                      selectedRankRow.seedling,
                      recommendation,
                      selectedRankRow.matchPercent,
                    )
                  }
                  activeOpacity={0.9}
                  disabled={saving}
                >
                  <Text style={styles.monitorBtnText}>
                    {saving ? "Uploading…" : "Confirm & add to seedling progress"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
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
  warnFootnote: {
    color: theme.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
    fontStyle: "italic",
  },
  areaNeedCard: {
    backgroundColor: theme.accentSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accentDark,
    padding: 16,
    marginBottom: 16,
  },
  areaNeedLabel: {
    color: theme.accentDark,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  areaNeedValue: {
    color: theme.accentDark,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 4,
  },
  areaNeedHint: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    opacity: 0.9,
  },
  monitorBtn: {
    marginTop: 14,
    backgroundColor: theme.accentDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  monitorBtnDisabled: {
    opacity: 0.55,
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
