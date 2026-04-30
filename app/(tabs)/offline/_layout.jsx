import { Stack } from "expo-router";
import { theme } from "../../../lib/theme";

export default function OfflineStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="sync" />
      <Stack.Screen name="map" />
    </Stack>
  );
}
