import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeSeedlingCapture } from '../../lib/analyzeCapture';
import { isRejectedFieldCapture } from '../../lib/captureValidity';
import { findNearestPenroPlot } from '../../lib/penroSpeciesRecommendations';
import { getCaptureCoordinates } from '../../lib/deviceLocation';
import {
	insertMonitorSeedlingSubmission,
	insertSceneAssessmentSubmission,
} from '../../lib/monitoringSubmissions';
import { fetchReforestationPlots } from '../../lib/reforestationPlots';
import { supabase } from '../../lib/supabase';
import { SURVEY_LATITUDE, SURVEY_LONGITUDE } from '../../lib/surveyLocation';
import { theme } from '../../lib/theme';

const GRID_LABELS = ['S1', 'S2', 'S3', null, null, null, null, null, null];
const SELECTABLE_GRID = new Set(['S1', 'S2', 'S3']);

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
	const [coords, setCoords] = React.useState({
		latitude: SURVEY_LATITUDE,
		longitude: SURVEY_LONGITUDE,
		source: 'survey_fallback',
		accuracyMeters: null,
	});
	const [gpsRefreshing, setGpsRefreshing] = React.useState(false);
	const [plots, setPlots] = React.useState([]);
	const [selectedPlotId, setSelectedPlotId] = React.useState(null);
	const [selectedGridCell, setSelectedGridCell] = React.useState('S1');

	const refreshGps = React.useCallback(async () => {
		setGpsRefreshing(true);
		try {
			const next = await getCaptureCoordinates();
			setCoords(next);
		} finally {
			setGpsRefreshing(false);
		}
	}, []);

	React.useEffect(() => {
		void refreshGps();
		let cancelled = false;
		(async () => {
			try {
				const list = await fetchReforestationPlots();
				if (cancelled) return;
				setPlots(list);
				if (list.length) {
					setSelectedPlotId((prev) => prev ?? list[0].id);
				}
			} catch (e) {
				console.warn('[capture] plots:', e?.message ?? e);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [refreshGps]);

	const selectedPlot = React.useMemo(
		() => plots.find((p) => p.id === selectedPlotId) ?? plots[0] ?? null,
		[plots, selectedPlotId],
	);

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
		if (typeof n === 'number' && !Number.isNaN(n)) {
			return Math.max(1, Math.round(n));
		}
		return null;
	}, [recommendation]);

	const selectedRankRow = React.useMemo(() => {
		if (!displayRanked.length) return null;
		const found = displayRanked.find(
			(r) => r.seedling.id === selectedSeedlingId,
		);
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
		if (Platform.OS === 'web') {
			Alert.alert(
				'Capture',
				'Camera capture runs on iOS and Android builds, not in the web preview.',
			);
			return;
		}
		if (!cameraGranted) {
			Alert.alert('Camera', 'Allow camera access first.');
			return;
		}
		if (!aiOn) {
			Alert.alert(
				'Aerial analysis off',
				'Turn on aerial analysis to assess plantable area and optional species hints.',
			);
			return;
		}
		const cam = cameraRef.current;
		if (!cam?.takePictureAsync) {
			Alert.alert('Camera', 'Preview is not ready yet.');
			return;
		}

		setAnalyzing(true);
		setRecommendation(null);
		lastCaptureBase64Ref.current = null;
		try {
			const captureCoords = await getCaptureCoordinates();
			setCoords(captureCoords);
			const photo = await cam.takePictureAsync({
				quality: 0.55,
				base64: true,
			});
			if (!photo?.base64) {
				throw new Error('Camera returned no image data.');
			}
			lastCaptureBase64Ref.current = photo.base64;
			let plotForAnalysis = selectedPlot;
			let nearestMeta = null;
			if (
				!plotForAnalysis?.species_planted &&
				typeof captureCoords.latitude === 'number' &&
				typeof captureCoords.longitude === 'number' &&
				plots.length
			) {
				const near = findNearestPenroPlot(
					plots,
					captureCoords.latitude,
					captureCoords.longitude,
				);
				if (near) {
					plotForAnalysis = near.plot;
					nearestMeta = { distanceMeters: near.distanceMeters };
				}
			}
			const result = await analyzeSeedlingCapture({
				base64: photo.base64,
				latitude: captureCoords.latitude,
				longitude: captureCoords.longitude,
				plot: plotForAnalysis,
				nearestMeta,
			});

			if (isRejectedFieldCapture(result)) {
				lastCaptureBase64Ref.current = null;
				setRecommendation({
					...result,
					unsuitableForPlanting: true,
					unsuitableReason:
						result.unsuitableReason ||
						result.captureValidity?.reason ||
						'Only outdoor land or aerial forest views are accepted.',
					estimatedSeedlingsNeeded: null,
					rankedSeedlings: [],
					recommended: null,
					alternatives: [],
				});
				Alert.alert(
					'Cannot record this photo',
					result.captureValidity?.reason ||
						result.unsuitableReason ||
						'Only outdoor land or aerial NGP plot views are accepted. Point the camera at trees, soil, or open ground on site.',
					[{ text: 'OK' }],
				);
				return;
			}

			setRecommendation(result);

			const plotUuid =
				selectedPlot?.id &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					String(selectedPlot.id),
				)
					? selectedPlot.id
					: null;
			const {
				data: { session },
			} = await supabase.auth.getSession();
			void insertSceneAssessmentSubmission({
				latitude: captureCoords.latitude,
				longitude: captureCoords.longitude,
				recommendation: result,
				imageBase64: photo.base64,
				plotId: plotUuid,
				plotRecord: selectedPlot,
				gridCell: selectedGridCell,
				userId: session?.user?.id ?? null,
				locationSource: captureCoords.source,
				accuracyMeters: captureCoords.accuracyMeters,
			}).catch((err) =>
				console.warn('[capture] scene assessment:', err?.message ?? err),
			);
		} catch (e) {
			const message = e?.message || 'Something went wrong.';
			Alert.alert('Capture & analyze', message);
		} finally {
			setAnalyzing(false);
		}
	}, [aiOn, cameraGranted, selectedPlot, selectedGridCell, plots]);

	const monitorSeedling = React.useCallback(
		async (seedling, recommendationSnapshot, selectedMatchPercent) => {
			if (!seedling?.id) return;
			if (isRejectedFieldCapture(recommendationSnapshot)) {
				Alert.alert(
					'Not a field capture',
					recommendationSnapshot?.unsuitableReason ||
						'Cannot save monitoring data from a screen or gadget photo.',
				);
				return;
			}
			const est = (() => {
				const n = recommendationSnapshot?.estimatedSeedlingsNeeded;
				if (typeof n === 'number' && !Number.isNaN(n)) {
					return Math.max(1, Math.round(n));
				}
				return 1;
			})();
			const imageBase64 = lastCaptureBase64Ref.current;
			setSaving(true);
			try {
				const liveCoords = await getCaptureCoordinates();
				setCoords(liveCoords);
				const {
					data: { session },
				} = await supabase.auth.getSession();
				const userId = session?.user?.id ?? null;

				const plotUuid =
					selectedPlot?.id &&
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
						String(selectedPlot.id),
					)
						? selectedPlot.id
						: null;

				await insertMonitorSeedlingSubmission({
					latitude: liveCoords.latitude,
					longitude: liveCoords.longitude,
					seedling,
					recommendation: recommendationSnapshot,
					selectedMatchPercent,
					imageBase64: imageBase64 ?? null,
					plotId: plotUuid,
					plotRecord: selectedPlot,
					gridCell: selectedGridCell,
					userId,
					locationSource: liveCoords.source,
					accuracyMeters: liveCoords.accuracyMeters,
				});

				if (userId) {
					const plotLabel = selectedPlot
						? `${selectedPlot.plot_code} — ${selectedPlot.name}`
						: 'Unassigned plot';
					const notesLine =
						`Plot: ${plotLabel}. Grid: ${selectedGridCell ?? '—'}. ` +
						`GPS: ${liveCoords.latitude.toFixed(5)}°, ${liveCoords.longitude.toFixed(5)}°. ` +
						`Estimated seedlings for captured area: ${est}.`;
					const { error } = await supabase.from('seedling_progress').insert({
						user_id: userId,
						plot_id: plotUuid,
						seedling_id: seedling.id,
						common_name: seedling.commonName ?? null,
						scientific_name: seedling.scientificName ?? null,
						status: 'planned',
						notes: notesLine,
					});
					if (error)
						console.warn('[capture] seedling_progress:', error.message);
				}

				lastCaptureBase64Ref.current = null;
				router.push('/seedling-progress');
			} catch (e) {
				Alert.alert('Could not save', e?.message ?? 'Try again.');
			} finally {
				setSaving(false);
			}
		},
		[router, selectedPlot, selectedGridCell],
	);

	const promptConfirmSeedling = React.useCallback(
		(seedling, snapshot, matchPercent) => {
			if (!seedling?.id || !snapshot) return;
			if (isRejectedFieldCapture(snapshot)) {
				Alert.alert(
					'Not a field capture',
					snapshot.unsuitableReason ||
						'Retake a photo of the NGP site before confirming a seedling.',
				);
				return;
			}
			const n = (() => {
				const v = snapshot.estimatedSeedlingsNeeded;
				if (typeof v === 'number' && !Number.isNaN(v)) {
					return Math.max(1, Math.round(v));
				}
				return 1;
			})();
			Alert.alert(
				'Confirm seedling',
				`Add ${seedling.commonName ?? seedling.id} to your seedling progress?\n\n` +
					`Seedlings needed for this area (estimate): ${n}.\n` +
					`One admin record will be created with your capture image and confirmed species.`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Confirm & add',
						style: 'default',
						onPress: () => monitorSeedling(seedling, snapshot, matchPercent),
					},
				],
			);
		},
		[monitorSeedling],
	);

	return (
		<SafeAreaView style={styles.root} edges={['top']}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}>
				<View style={styles.headerBlock}>
					<Text style={styles.title}>Field capture</Text>
					<Text style={styles.subtitle}>
						Aerial forest-area view · plantability · survival monitoring
					</Text>
				</View>

				<View style={styles.gpsBar}>
					<View style={styles.gpsBarMain}>
						<Text style={styles.gpsBarLeft}>GPS location</Text>
						<Text style={styles.gpsBarRight}>
							{coords.latitude.toFixed(5)}°N {coords.longitude.toFixed(5)}°E
						</Text>
						<Text style={styles.gpsMeta}>
							{coords.source === 'gps'
								? `Live GPS${coords.accuracyMeters != null ? ` ±${Math.round(coords.accuracyMeters)} m` : ''}`
								: 'Survey reference (enable location for live GPS)'}
						</Text>
					</View>
					<TouchableOpacity
						onPress={() => void refreshGps()}
						disabled={gpsRefreshing}
						style={styles.gpsRefreshBtn}>
						{gpsRefreshing ? (
							<ActivityIndicator size="small" color="#fff" />
						) : (
							<Ionicons name="locate" size={20} color="#fff" />
						)}
					</TouchableOpacity>
				</View>

				{plots.length > 0 ? (
					<View style={styles.plotCard}>
						<Text style={styles.plotLabel}>NGP site (PENRO reference)</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.plotChips}>
							{plots.map((plot) => {
								const active = plot.id === (selectedPlotId ?? plots[0]?.id);
								return (
									<TouchableOpacity
										key={plot.id}
										style={[styles.plotChip, active && styles.plotChipActive]}
										onPress={() => setSelectedPlotId(plot.id)}>
										<Text
											style={[
												styles.plotChipCode,
												active && styles.plotChipTextActive,
											]}>
											{plot.site_code ?? plot.plot_code}
										</Text>
										<Text
											style={[
												styles.plotChipName,
												active && styles.plotChipTextActive,
											]}
											numberOfLines={1}>
											{plot.name}
										</Text>
									</TouchableOpacity>
								);
							})}
						</ScrollView>
						{selectedPlot ? (
							<Text style={styles.plotHint}>
								Contracted:{' '}
								{selectedPlot.seedlings_contracted ??
									selectedPlot.target_seedlings}{' '}
								seedlings
								{selectedPlot.area_ha ? ` · ${selectedPlot.area_ha} ha` : ''}
								{selectedPlot.latest_survival_rate != null
									? ` · PENRO survival ${Math.round(Number(selectedPlot.latest_survival_rate) * 100)}%`
									: ''}
								{' · '}
								{selectedPlot.municipality}
								{selectedPlot.barangay ? ` · ${selectedPlot.barangay}` : ''}
							</Text>
						) : null}
					</View>
				) : null}

				<View style={styles.optionsCard}>
					<View style={styles.toggleRow}>
						<Text style={styles.toggleLabel}>Survey grid</Text>
						<Switch
							value={gridOn}
							onValueChange={setGridOn}
							trackColor={{ false: theme.border, true: theme.accentDark }}
							thumbColor={gridOn ? theme.accent : theme.textMuted}
						/>
					</View>
					<View style={styles.toggleDivider} />
					<View style={styles.toggleRow}>
						<Text style={styles.toggleLabel}>Aerial analysis</Text>
						<Switch
							value={aiOn}
							onValueChange={setAiOn}
							trackColor={{ false: theme.border, true: theme.accentDark }}
							thumbColor={aiOn ? theme.accent : theme.textMuted}
						/>
					</View>
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
							pointerEvents={gridOn ? 'auto' : 'none'}>
							{GRID_LABELS.map((label, index) => {
								const isCenter = index === 4;
								const selectable = label && SELECTABLE_GRID.has(label);
								const isSelected = selectable && label === selectedGridCell;

								return (
									<TouchableOpacity
										key={index}
										activeOpacity={selectable ? 0.75 : 1}
										disabled={!selectable}
										onPress={() => {
											if (selectable) setSelectedGridCell(label);
										}}
										style={[
											styles.gridCell,
											isCenter && styles.gridCellCenter,
											isSelected && styles.gridCellSelected,
											cameraGranted &&
												(isCenter
													? styles.gridCellCenterOverCamera
													: styles.gridCellOverCamera),
										]}>
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
												]}>
												{label}
											</Text>
										)}
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{!cameraGranted ? (
						<TouchableOpacity
							style={styles.permissionBtn}
							onPress={requestPermission}
							disabled={
								!permission?.canAskAgain && permission?.status === 'denied'
							}>
							<Text style={styles.permissionBtnText}>
								{permission?.status === 'denied' && !permission?.canAskAgain
									? 'Camera blocked — enable in Settings'
									: 'Request camera permission'}
							</Text>
						</TouchableOpacity>
					) : null}
				</View>

				<TouchableOpacity
					style={[
						styles.captureBtn,
						(!cameraGranted || analyzing || saving || !aiOn) &&
							styles.captureBtnDisabled,
					]}
					activeOpacity={0.9}
					onPress={handleCapturePress}
					disabled={!cameraGranted || analyzing || saving || !aiOn}>
					<View style={styles.captureInner}>
						{analyzing || saving ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Ionicons name="camera" size={22} color="#fff" />
						)}
						<Text style={styles.captureText}>
							{saving
								? 'Uploading & saving…'
								: analyzing
									? 'Analyzing scene…'
									: 'Capture aerial view'}
						</Text>
					</View>
				</TouchableOpacity>
				{!aiOn ? (
					<Text style={styles.captureHint}>
						Turn on aerial analysis to assess plantable area and DENR species
						hints.
					</Text>
				) : null}

				{recommendation?.forestArea &&
				!isRejectedFieldCapture(recommendation) ? (
					<View
						style={[
							styles.forestCard,
							recommendation.forestArea.isPlantable
								? styles.forestCardOk
								: styles.forestCardWarn,
						]}>
						<Text style={styles.forestHeading}>
							Aerial forest-area assessment
						</Text>
						<View style={styles.forestMetrics}>
							<View style={styles.forestMetric}>
								<Text style={styles.forestMetricVal}>
									{recommendation.forestArea.plantabilityScore}%
								</Text>
								<Text style={styles.forestMetricLbl}>Plantability</Text>
							</View>
							<View style={styles.forestMetric}>
								<Text style={styles.forestMetricVal}>
									{recommendation.forestArea.forestCanopyPct}%
								</Text>
								<Text style={styles.forestMetricLbl}>Canopy cover</Text>
							</View>
							<View style={styles.forestMetric}>
								<Text style={styles.forestMetricVal}>
									{recommendation.forestArea.healthIndex}%
								</Text>
								<Text style={styles.forestMetricLbl}>Health index</Text>
							</View>
						</View>
						<Text style={styles.forestSummary}>
							{recommendation.forestArea.summary}
						</Text>
						<Text style={styles.forestNote}>
							{recommendation.forestArea.aerialViewNote}
						</Text>
						<Text style={styles.forestSaved}>
							Site assessment saved for survival & health trend monitoring.
						</Text>
					</View>
				) : null}

				{recommendation?.denrPlotRequired ? (
					<View style={[styles.recoCard, styles.warnCard]}>
						<Text style={styles.warnHeading}>NGP site required</Text>
						<Text style={styles.warnBody}>
							{recommendation.rationale ||
								'Select an NGP site chip above (or stand within ~3.5 km of a registered site) so species are ranked from the DENR PENRO contract list.'}
						</Text>
					</View>
				) : null}

				{recommendation?.unsuitableForPlanting ? (
					<View style={[styles.recoCard, styles.warnCard]}>
						<Text style={styles.warnHeading}>
							{[
								'keyboard_or_gadget',
								'screen_or_display',
								'not_land_or_aerial',
								'hardscape_concrete',
								'wood_or_boards',
								'hardscape_built',
							].includes(recommendation.captureValidity?.captureIssueType)
								? 'Cannot record — unplantable surface'
								: 'Not plantable for new stocking'}
						</Text>
						<Text style={styles.warnBody}>
							{recommendation.unsuitableReason ||
								recommendation.rationale ||
								'This scene appears dominated by concrete or hardscape. Capture a vegetated or open plantable area for monitoring.'}
						</Text>
						<Text style={styles.warnFootnote}>
							Aerial assessment is still logged for canopy / hardscape
							monitoring. Confirm a seedling only on plantable ground.
						</Text>
					</View>
				) : null}

				{!recommendation?.unsuitableForPlanting && displayRanked.length ? (
					<>
						{seedlingsNeededForArea != null ? (
							<View style={styles.areaNeedCard}>
								<Text style={styles.areaNeedLabel}>For this captured area</Text>
								<Text style={styles.areaNeedValue}>
									{seedlingsNeededForArea}
								</Text>
								<Text style={styles.areaNeedHint}>
									Estimated seedlings from PENRO stocking density and assessed
									plantable area. Nothing is sent to the server until you confirm
									below; then one record is stored with this photo and your
									species choice.
								</Text>
							</View>
						) : null}

						<View style={styles.rankCard}>
							<Text style={styles.rankHeading}>DENR NGP contract species</Text>
							<Text style={styles.candidatesHint}>
								{recommendation.penroContext?.label
									? `${recommendation.penroContext.label} · `
									: ''}
								tap a row to select ·{' '}
								{recommendation.source === 'remote' ? 'server' : 'on-device'}
							</Text>
							{displayRanked.map((row) => {
								const selected = row.seedling.id === selectedSeedlingId;
								return (
									<TouchableOpacity
										key={row.seedling.id}
										style={[styles.rankRow, selected && styles.rankRowSelected]}
										onPress={() => setSelectedSeedlingId(row.seedling.id)}
										activeOpacity={0.85}>
										<Text style={styles.rankName}>
											{row.seedling.commonName}
											{row.seedling.id === recommendation.recommended?.id
												? ' · top match'
												: ''}
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
									{selectedRankRow.seedling.id ===
									recommendation.recommended?.id
										? ` · model confidence ${Math.round(
												(recommendation.confidence ?? 0) * 100,
											)}%`
										: ''}
									{seedlingsNeededForArea != null
										? ` · seedlings for area: ${seedlingsNeededForArea}`
										: ''}
								</Text>
								<Text style={styles.recoRationale}>
									{recommendation.rationale}
								</Text>
								{recommendation.alternatives?.length ? (
									<View style={styles.altRow}>
										<Text style={styles.altLabel}>Also consider: </Text>
										<Text style={styles.altText}>
											{recommendation.alternatives
												.map((a) => a.commonName)
												.join(' · ')}
										</Text>
									</View>
								) : null}
								<TouchableOpacity
									style={[
										styles.monitorBtn,
										saving && styles.monitorBtnDisabled,
									]}
									onPress={() =>
										promptConfirmSeedling(
											selectedRankRow.seedling,
											recommendation,
											selectedRankRow.matchPercent,
										)
									}
									activeOpacity={0.9}
									disabled={saving}>
									<Text style={styles.monitorBtnText}>
										{saving
											? 'Uploading…'
											: 'Confirm & add to seedling progress'}
									</Text>
								</TouchableOpacity>
							</View>
						) : null}
					</>
				) : null}

			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: theme.bg },
	scroll: { paddingHorizontal: 20, paddingBottom: 108 },
	headerBlock: {
		marginTop: 4,
		marginBottom: 16,
	},
	title: { color: theme.text, fontSize: 24, fontWeight: '800' },
	subtitle: {
		color: theme.textMuted,
		fontSize: 13,
		fontWeight: '500',
		marginTop: 6,
		lineHeight: 18,
	},
	gpsBar: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: theme.accentDark,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		marginBottom: 16,
		gap: 10,
	},
	gpsBarMain: { flex: 1 },
	gpsBarLeft: { color: '#E8F5E9', fontWeight: '700', fontSize: 13 },
	gpsBarRight: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 12,
		marginTop: 4,
		fontVariant: ['tabular-nums'],
	},
	gpsMeta: {
		color: 'rgba(232, 245, 233, 0.85)',
		fontSize: 11,
		marginTop: 4,
	},
	gpsRefreshBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(255,255,255,0.16)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	optionsCard: {
		backgroundColor: theme.bgCard,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: theme.border,
		paddingHorizontal: 14,
		paddingVertical: 4,
		marginBottom: 16,
	},
	toggleDivider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: theme.border,
	},
	plotCard: {
		backgroundColor: theme.bgCard,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: theme.border,
		padding: 12,
		marginBottom: 16,
	},
	plotLabel: {
		color: theme.textMuted,
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	plotChips: { gap: 8, paddingRight: 8 },
	plotChip: {
		minWidth: 120,
		maxWidth: 180,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: theme.border,
		backgroundColor: theme.bg,
	},
	plotChipActive: {
		borderColor: theme.accent,
		backgroundColor: theme.accentSurface,
	},
	plotChipCode: { color: theme.text, fontWeight: '800', fontSize: 13 },
	plotChipName: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
	plotChipTextActive: { color: theme.accentDark },
	plotHint: { color: theme.textMuted, fontSize: 11, marginTop: 10 },
	forestCard: {
		borderRadius: 16,
		borderWidth: 1,
		padding: 16,
		marginBottom: 16,
	},
	forestCardOk: {
		borderColor: theme.accent,
		backgroundColor: theme.accentSurface,
	},
	forestCardWarn: {
		borderColor: theme.orange,
		backgroundColor: 'rgba(255, 152, 0, 0.1)',
	},
	forestHeading: {
		color: theme.text,
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 12,
	},
	forestMetrics: { flexDirection: 'row', gap: 8, marginBottom: 12 },
	forestMetric: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 10,
		borderRadius: 10,
		backgroundColor: 'rgba(0,0,0,0.06)',
	},
	forestMetricVal: { color: theme.text, fontSize: 20, fontWeight: '800' },
	forestMetricLbl: {
		color: theme.textMuted,
		fontSize: 10,
		fontWeight: '600',
		marginTop: 4,
		textAlign: 'center',
	},
	forestSummary: { color: theme.text, fontSize: 14, lineHeight: 20 },
	forestNote: {
		color: theme.textMuted,
		fontSize: 12,
		lineHeight: 18,
		marginTop: 8,
		fontStyle: 'italic',
	},
	forestSaved: {
		color: theme.accentDark,
		fontSize: 11,
		fontWeight: '700',
		marginTop: 10,
	},
	gridCellSelected: {
		borderWidth: 2,
		borderColor: theme.accent,
	},
	mapCard: {
		backgroundColor: '#3A3A3A',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: theme.border,
		padding: 10,
		marginBottom: 16,
		overflow: 'hidden',
	},
	mapCardStack: {
		position: 'relative',
		borderRadius: 10,
		overflow: 'hidden',
	},
	cameraPreview: {
		...StyleSheet.absoluteFillObject,
		zIndex: 0,
	},
	gridWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		justifyContent: 'center',
		zIndex: 1,
	},
	gridHidden: {
		opacity: 0,
	},
	gridCell: {
		width: '30%',
		aspectRatio: 1,
		backgroundColor: '#4A4A4A',
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
		overflow: 'hidden',
	},
	gridCellCenter: {
		backgroundColor: 'rgba(200, 230, 201, 0.35)',
		borderWidth: 1,
		borderColor: theme.accent,
	},
	gridCellOverCamera: {
		backgroundColor: 'rgba(74, 74, 74, 0.4)',
	},
	gridCellCenterOverCamera: {
		backgroundColor: 'rgba(200, 230, 201, 0.28)',
	},
	permissionBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 4 },
	permissionBtnText: { color: theme.accent, fontWeight: '700' },
	gridLabel: { color: theme.textMuted, fontWeight: '700', fontSize: 12 },
	gridLabelCenter: { color: theme.text },
	crosshair: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
	},
	crossV: {
		position: 'absolute',
		width: 2,
		height: '70%',
		backgroundColor: theme.text,
		opacity: 0.9,
	},
	crossH: {
		position: 'absolute',
		height: 2,
		width: '70%',
		backgroundColor: theme.text,
		opacity: 0.9,
	},
	captureBtn: {
		borderRadius: 14,
		backgroundColor: theme.accentDark,
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.12,
		shadowRadius: 4,
		elevation: 3,
	},
	captureBtnDisabled: {
		opacity: 0.5,
	},
	captureInner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
		paddingVertical: 16,
	},
	captureText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
	captureHint: {
		color: theme.textMuted,
		fontSize: 12,
		lineHeight: 17,
		marginBottom: 16,
		textAlign: 'center',
	},
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
		fontWeight: '800',
		marginBottom: 8,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	recoTitle: {
		color: theme.text,
		fontSize: 20,
		fontWeight: '800',
	},
	recoSci: {
		color: theme.textMuted,
		fontSize: 13,
		fontStyle: 'italic',
		marginTop: 2,
		marginBottom: 10,
	},
	recoNotes: { color: theme.text, fontSize: 14, lineHeight: 20 },
	recoMeta: {
		color: theme.textMuted,
		fontSize: 12,
		fontWeight: '600',
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
		fontWeight: '700',
	},
	altText: { color: theme.text, fontSize: 13, marginTop: 4, lineHeight: 18 },
	warnCard: {
		borderColor: theme.orange,
		backgroundColor: 'rgba(255, 152, 0, 0.12)',
	},
	warnHeading: {
		color: theme.orange,
		fontSize: 13,
		fontWeight: '800',
		marginBottom: 8,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	warnBody: { color: theme.text, fontSize: 14, lineHeight: 20 },
	warnFootnote: {
		color: theme.textMuted,
		fontSize: 12,
		lineHeight: 17,
		marginTop: 12,
		fontStyle: 'italic',
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
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	areaNeedValue: {
		color: theme.accentDark,
		fontSize: 36,
		fontWeight: '800',
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
		alignItems: 'center',
	},
	monitorBtnDisabled: {
		opacity: 0.55,
	},
	monitorBtnText: { color: theme.text, fontWeight: '800', fontSize: 14 },
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
		fontWeight: '800',
		marginBottom: 6,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	candidatesHint: {
		color: theme.textMuted,
		fontSize: 12,
		marginBottom: 10,
	},
	rankRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: theme.border,
	},
	rankRowSelected: {
		backgroundColor: 'rgba(129, 199, 132, 0.14)',
		marginHorizontal: -8,
		paddingHorizontal: 8,
		borderRadius: 8,
	},
	rankName: { color: theme.text, fontWeight: '600', fontSize: 14, flex: 1 },
	rankPct: { color: theme.textMuted, fontWeight: '800', fontSize: 14 },
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
		fontWeight: '700',
		marginBottom: 10,
	},
	toolsRow: { flexDirection: 'row', justifyContent: 'space-between' },
	toolAdd: { color: theme.accent, fontWeight: '700', fontSize: 14 },
	toolRemove: { color: theme.text, fontWeight: '700', fontSize: 14 },
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
	},
	toggleLabel: { color: theme.text, fontWeight: '600', fontSize: 14 },
	kpiRow: { flexDirection: 'row', gap: 8 },
	kpi: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
	kpiOk: { backgroundColor: theme.accentSurface },
	kpiWarn: { backgroundColor: '#FFCC80' },
	kpiNeutral: {
		backgroundColor: theme.bgCard,
		borderWidth: 1,
		borderColor: theme.border,
	},
	kpiTextDark: { color: theme.accentDark, fontWeight: '800', fontSize: 11 },
	kpiTextLight: { color: theme.text, fontWeight: '800', fontSize: 11 },
});
