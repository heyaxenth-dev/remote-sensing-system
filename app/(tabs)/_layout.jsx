import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../lib/theme";

const TAB_CONFIG = [
  { name: "home", title: "Home", icon: "home", iconOutline: "home-outline" },
  {
    name: "capture",
    title: "Field",
    icon: "images",
    iconOutline: "images-outline",
  },
  {
    name: "seedling-progress",
    title: "Survival",
    icon: "leaf",
    iconOutline: "leaf-outline",
  },
  { name: "offline", title: "Offline", icon: "cloud-offline", iconOutline: "cloud-offline-outline" },
  { name: "settings", title: "Settings", icon: "settings", iconOutline: "settings-outline" },
];

function FieldTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabOuter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const cfg = TAB_CONFIG.find((t) => t.name === route.name);
          const iconName = isFocused ? cfg?.icon : cfg?.iconOutline;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabPress}
            >
              <View style={[styles.tabPill, isFocused && styles.tabPillActive]}>
                <Ionicons
                  name={iconName ?? "ellipse-outline"}
                  size={22}
                  color={isFocused ? theme.accentDark : theme.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FieldTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="capture" options={{ title: "Field" }} />
      <Tabs.Screen name="seedling-progress" options={{ title: "Survival" }} />
      <Tabs.Screen name="offline" options={{ title: "Offline" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabOuter: {
    backgroundColor: theme.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabPress: {
    alignItems: "center",
    minWidth: 64,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tabPillActive: {
    backgroundColor: theme.accentSurface,
  },
  tabLabel: {
    marginTop: 4,
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: theme.accent,
  },
});
