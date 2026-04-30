import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { theme } from "../../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const [offlineDefault, setOfflineDefault] = React.useState(true);
  const [autoSync, setAutoSync] = React.useState(true);
  const [gpsOverlay, setGpsOverlay] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSubtitle}>App preferences & device</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App preferences</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Offline mode default</Text>
            <Switch
              value={offlineDefault}
              onValueChange={setOfflineDefault}
              trackColor={{ false: theme.border, true: theme.accentDark }}
              thumbColor={offlineDefault ? theme.accent : theme.textMuted}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Auto sync on network</Text>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: theme.border, true: theme.accentDark }}
              thumbColor={autoSync ? theme.accent : theme.textMuted}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.label}>Show GPS overlay</Text>
            <Switch
              value={gpsOverlay}
              onValueChange={setGpsOverlay}
              trackColor={{ false: theme.border, true: theme.accentDark }}
              thumbColor={gpsOverlay ? theme.accent : theme.textMuted}
            />
          </View>
        </View>

        <View style={[styles.card, styles.cardAccount]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            {loggingOut ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <Text style={styles.logoutBtnText}>Log out</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  screenTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  screenSubtitle: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  },
  sectionTitle: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    marginBottom: 4,
  },
  rowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  cardAccount: {
    marginTop: 16,
  },
  logoutBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.danger,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: theme.bg,
  },
  logoutBtnText: {
    color: theme.danger,
    fontWeight: "800",
    fontSize: 15,
  },
  label: { color: theme.text, fontSize: 14, fontWeight: "600", flex: 1, paddingRight: 12 },
});
