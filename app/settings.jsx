import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings() {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Offline mode default</Text>
            <Switch value />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Auto sync on network</Text>
            <Switch value />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Show GPS overlay</Text>
            <Switch value />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const LIGHT_BG = "#F7F9F7";
const BORDER = "#D9E2D9";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT_BG },
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 14, color: "#1B1B1B" },
  card: {
    width: 320,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10, color: "#1F1F1F" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  label: { fontSize: 12, color: "#2E2E2E", fontWeight: "600" },
});
