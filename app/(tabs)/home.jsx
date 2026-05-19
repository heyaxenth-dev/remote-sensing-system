import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { SURVEY_LATITUDE, SURVEY_LONGITUDE } from '../../lib/surveyLocation';
import { theme } from '../../lib/theme';
import { fetchCurrentUserProfile } from '../../lib/userProfile';
import { fetchWeatherForDashboard } from '../../lib/weather';

const QUICK_ACTIONS = [
	{
		key: 'acquire',
		label: 'Field capture\n& plantability',
		route: '/capture',
		icon: 'grid-outline',
		highlighted: true,
	},
	{
		key: 'progress',
		label: 'Survival &\nhealth trends',
		route: '/seedling-progress',
		icon: 'leaf-outline',
		highlighted: false,
	},
	{
		key: 'offline',
		label: 'Offline operation\n& storage',
		route: '/offline',
		icon: 'document-text-outline',
		highlighted: false,
	},
	{
		key: 'sync',
		label: 'Data\nsynchronization',
		route: '/offline/sync',
		icon: 'time-outline',
		highlighted: false,
	},
	{
		key: 'map',
		label: 'Offline map\n& navigation',
		route: '/offline/map',
		icon: 'locate-outline',
		highlighted: false,
	},
];

export default function HomeScreen() {
	const router = useRouter();
	const [menuOpen, setMenuOpen] = React.useState(false);
	const [displayName, setDisplayName] = React.useState('Field officer');
	const [roleLabel, setRoleLabel] = React.useState('Field officer');
	const [weatherLine, setWeatherLine] = React.useState(null);
	const [weatherLoading, setWeatherLoading] = React.useState(true);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			const profile = await fetchCurrentUserProfile();
			if (cancelled) return;
			setDisplayName(profile.displayName);
			setRoleLabel(profile.roleLabel);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			setWeatherLoading(true);
			const w = await fetchWeatherForDashboard(
				SURVEY_LATITUDE,
				SURVEY_LONGITUDE,
			);
			if (cancelled) return;
			if (w.ok) setWeatherLine(w.summary);
			else setWeatherLine('Weather unavailable');
			setWeatherLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<SafeAreaView style={styles.root} edges={["top"]}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}>
				<View style={styles.topBar}>
					<View>
						<Text style={styles.brandSmall}>DENR-CENRO · Culasi</Text>
						<Text style={styles.greeting}>Welcome, {displayName}.</Text>
						<Text style={styles.roleLine}>{roleLabel}</Text>
					</View>
					<TouchableOpacity
						onPress={() => setMenuOpen(true)}
						style={styles.iconBtn}
						accessibilityLabel="Open menu">
						<Ionicons name="menu" size={26} color={theme.text} />
					</TouchableOpacity>
				</View>

				<View style={styles.weatherCard}>
					<View style={styles.weatherHeader}>
						<Text style={styles.weatherTitle}>Survey location weather</Text>
						<Text style={styles.weatherCoords}>
							{SURVEY_LATITUDE.toFixed(2)}°N · {SURVEY_LONGITUDE.toFixed(2)}°E
						</Text>
					</View>
					<Text style={styles.weatherBody}>
						{weatherLoading ? 'Loading conditions…' : weatherLine}
					</Text>
					<Text style={styles.weatherFoot}>
						Open-Meteo (no API key). Supports survival monitoring context only.
					</Text>
				</View>

				<Text style={styles.sectionTitle}>Quick actions</Text>
				<View style={styles.actionGrid}>
					{QUICK_ACTIONS.map((action) => (
						<TouchableOpacity
							key={action.key}
							style={[
								styles.actionTile,
								action.highlighted && styles.actionTileActive,
							]}
							onPress={() => router.push(action.route)}
							activeOpacity={0.85}>
							<Ionicons
								name={action.icon}
								size={28}
								color={action.highlighted ? theme.accentDark : theme.accent}
							/>
							<Text
								style={[
									styles.actionLabel,
									action.highlighted && styles.actionLabelActive,
								]}>
								{action.label}
							</Text>
						</TouchableOpacity>
					))}
				</View>

				<View style={styles.statusCard}>
					<View style={styles.statusRow}>
						<Text style={styles.statusLabel}>Pending sync</Text>
						<Text style={styles.statusValue}>3 reports waiting</Text>
						<TouchableOpacity onPress={() => router.push('/offline/sync')}>
							<Text style={styles.link}>Sync now</Text>
						</TouchableOpacity>
					</View>
					<View style={styles.divider} />
					<View style={styles.statusRow}>
						<Text style={styles.statusLabel}>Last sync</Text>
						<View style={styles.rowEnd}>
							<View style={[styles.dot, styles.dotGreen]} />
							<Text style={styles.statusValueMuted}>2 hrs ago</Text>
						</View>
					</View>
					<View style={styles.divider} />
					<View style={styles.statusRow}>
						<Text style={styles.statusLabel}>Active alerts</Text>
						<View style={styles.rowEnd}>
							<View style={[styles.dot, styles.dotOrange]} />
							<Text style={styles.statusValueMuted}>2 warnings</Text>
						</View>
					</View>
				</View>
			</ScrollView>

			<Modal visible={menuOpen} animationType="fade" transparent>
				<Pressable
					style={styles.modalBackdrop}
					onPress={() => setMenuOpen(false)}>
					<View style={styles.menuSheet}>
						<Text style={styles.menuTitle}>Menu</Text>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/capture');
							}}>
							<Text style={styles.menuItemText}>Mobile data acquisition</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/seedling-progress');
							}}>
							<Text style={styles.menuItemText}>Seedling progress</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/offline');
							}}>
							<Text style={styles.menuItemText}>
								Offline operation & storage
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/offline/sync');
							}}>
							<Text style={styles.menuItemText}>Data synchronization</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/offline/map');
							}}>
							<Text style={styles.menuItemText}>Offline map & navigation</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.menuItem}
							onPress={() => {
								setMenuOpen(false);
								router.push('/settings');
							}}>
							<Text style={styles.menuItemText}>Settings</Text>
						</TouchableOpacity>
					</View>
				</Pressable>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: theme.bg },
	scroll: { paddingHorizontal: 20, paddingBottom: 24 },
	topBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginTop: 8,
		marginBottom: 20,
	},
	brandSmall: {
		color: theme.accent,
		fontWeight: '800',
		fontSize: 13,
		letterSpacing: 0.5,
	},
	greeting: {
		color: theme.text,
		fontSize: 20,
		fontWeight: '700',
		marginTop: 6,
		maxWidth: 280,
	},
	roleLine: {
		color: theme.textMuted,
		fontSize: 13,
		fontWeight: '600',
		marginTop: 4,
	},
	iconBtn: { padding: 4 },
	weatherCard: {
		backgroundColor: theme.bgCard,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: theme.border,
		padding: 16,
		marginBottom: 20,
	},
	weatherHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
		gap: 12,
	},
	weatherTitle: {
		color: theme.text,
		fontSize: 15,
		fontWeight: '800',
		flex: 1,
	},
	weatherCoords: {
		color: theme.textMuted,
		fontSize: 11,
		fontWeight: '600',
		textAlign: 'right',
		maxWidth: 120,
	},
	weatherBody: {
		color: theme.text,
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '600',
	},
	weatherFoot: {
		color: theme.textMuted,
		fontSize: 11,
		marginTop: 10,
		lineHeight: 16,
	},
	sectionTitle: {
		color: theme.textMuted,
		fontSize: 13,
		fontWeight: '600',
		marginBottom: 12,
	},
	actionGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		marginBottom: 20,
	},
	actionTile: {
		width: '47%',
		flexGrow: 1,
		minHeight: 100,
		backgroundColor: theme.bgCard,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: theme.border,
		padding: 14,
		justifyContent: 'space-between',
	},
	actionTileActive: {
		backgroundColor: theme.accentSurface,
		borderColor: theme.accentDark,
	},
	actionLabel: {
		color: theme.text,
		fontSize: 12,
		fontWeight: '700',
		lineHeight: 16,
		marginTop: 8,
	},
	actionLabelActive: {
		color: theme.accentDark,
	},
	statusCard: {
		backgroundColor: theme.bgCard,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: theme.border,
		padding: 16,
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		flexWrap: 'wrap',
		gap: 8,
	},
	statusLabel: {
		color: theme.textMuted,
		fontSize: 12,
		fontWeight: '600',
		flex: 1,
	},
	statusValue: {
		color: theme.text,
		fontSize: 12,
		fontWeight: '600',
	},
	statusValueMuted: {
		color: theme.textMuted,
		fontSize: 12,
		fontWeight: '600',
	},
	rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	dotGreen: { backgroundColor: theme.accentDark },
	dotOrange: { backgroundColor: theme.orange },
	link: {
		color: theme.accent,
		fontSize: 12,
		fontWeight: '700',
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: theme.border,
		marginVertical: 12,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.55)',
		justifyContent: 'flex-start',
		paddingTop: 56,
		paddingHorizontal: 16,
	},
	menuSheet: {
		backgroundColor: theme.bgElevated,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: theme.border,
		paddingVertical: 8,
	},
	menuTitle: {
		color: theme.textMuted,
		fontSize: 12,
		fontWeight: '700',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	menuItem: {
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: theme.border,
	},
	menuItemText: {
		color: theme.text,
		fontSize: 15,
		fontWeight: '600',
	},
});
