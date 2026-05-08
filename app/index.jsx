import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { theme } from "../lib/theme";

export default function Index() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const user = data?.user ?? data?.session?.user;
    const metaName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    if (user?.id && metaName) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? normalizedEmail,
          full_name: metaName,
        },
        { onConflict: "id" },
      );
      if (profileError) {
        console.warn("[login] profiles upsert:", profileError.message);
      }
    }

    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="DENR-CENRO logo"
          />
          <Text style={styles.brand}>DENR-CENRO</Text>
          <Text style={styles.tagline}>Field Monitoring System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            placeholder="Enter Email"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.inputFlex}
            />
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={theme.textMuted}
            />
          </View>

          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>
              {isLoading ? "Logging in…" : "Log in"}
            </Text>
          </TouchableOpacity>

          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push("/sign-up")}
            activeOpacity={0.7}
          >
            <Text style={styles.footer}>
              Don&apos;t have an account?{" "}
              <Text style={styles.footerHighlight}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.offlinePill}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>Offline mode available</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  hero: {
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    marginBottom: 4,
  },
  logo: {
    width: "72%",
    maxWidth: 220,
    height: 88,
    marginBottom: 20,
  },
  brand: {
    color: theme.accent,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tagline: {
    color: theme.textMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 28,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
  },
  fieldLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: theme.bgCard,
    color: theme.text,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: theme.bgCard,
    gap: 8,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 15,
  },
  forgot: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  primaryBtnText: {
    color: theme.text,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
  },
  error: {
    marginTop: 12,
    color: theme.danger,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  footer: {
    marginTop: 16,
    color: theme.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  footerHighlight: {
    color: theme.accent,
    fontWeight: "800",
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
    marginBottom: 20,
    backgroundColor: theme.pillOffline,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accentDark,
  },
  offlineText: {
    color: theme.accentDark,
    fontWeight: "800",
    fontSize: 12,
  },
});
