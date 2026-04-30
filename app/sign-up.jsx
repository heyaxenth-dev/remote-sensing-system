import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { theme } from "../lib/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const handleSignUp = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      setErrorMessage("Please fill in all fields.");
      setSuccessMessage("");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      setSuccessMessage("");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setSuccessMessage("");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = fullName.trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      ...(trimmedName ? { options: { data: { full_name: trimmedName } } } : {}),
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace("/home");
      return;
    }

    setSuccessMessage(
      "Account created. If email confirmation is enabled, check your inbox to verify before signing in.",
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.brand}>DENR-CENRO</Text>
        <Text style={styles.screenTitle}>Create account</Text>
        <Text style={styles.screenSubtitle}>Field monitoring system</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Full name (optional)</Text>
          <TextInput
            placeholder="Juan dela Cruz"
            placeholderTextColor={theme.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            placeholder="name@agency.gov.ph"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            placeholder="Min. 6 characters"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Confirm password</Text>
          <TextInput
            placeholder="Re-enter password"
            placeholderTextColor={theme.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>
              {isLoading ? "Creating account…" : "Sign up"}
            </Text>
          </TouchableOpacity>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          <TouchableOpacity onPress={() => router.back()} style={styles.backWrap} activeOpacity={0.7}>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </TouchableOpacity>
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
    paddingTop: 16,
    alignItems: "center",
  },
  brand: {
    color: theme.accent,
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.5,
  },
  screenTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 12,
  },
  screenSubtitle: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 20,
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
    marginBottom: 12,
    backgroundColor: theme.bgCard,
    color: theme.text,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: theme.accentSurface,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.accentDark,
  },
  primaryBtnText: {
    color: theme.accentDark,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
  },
  link: {
    marginTop: 14,
    color: theme.accent,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  backWrap: {
    marginTop: 4,
  },
  error: {
    marginTop: 10,
    color: theme.danger,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  success: {
    marginTop: 10,
    color: theme.accent,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
});
