import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  colorThemes,
  radii,
  spacing,
  typography
} from "@meadtools/design-tokens";

import { useSession } from "@/providers/app-providers";

const colors = colorThemes.dark;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signInMutation = useMutation({
    mutationFn: signIn
  });
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    !signInMutation.isPending;
  const errorMessage =
    signInMutation.error instanceof MeadToolsApiError &&
    signInMutation.error.status === 401
      ? t("auth.login.error")
      : t("error");

  function handleSignIn() {
    if (!canSubmit) {
      return;
    }

    signInMutation.mutate({
      email: email.trim(),
      password
    });
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.glow} />
      <View style={styles.form}>
        <Image
          accessibilityLabel="MeadTools"
          source={require("@/assets/images/meadtools-logo.png")}
          style={styles.mark}
        />
        <Text accessibilityRole="header" selectable style={styles.heading}>
          {t("accountPage.login")}
        </Text>
        <TextInput
          accessibilityLabel={t("accountPage.email")}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          placeholder={t("accountPage.email")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textContentType="emailAddress"
          value={email}
        />
        <TextInput
          accessibilityLabel={t("accountPage.password")}
          autoCapitalize="none"
          autoComplete="current-password"
          onChangeText={setPassword}
          onSubmitEditing={handleSignIn}
          placeholder={t("accountPage.password")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          textContentType="password"
          value={password}
        />
        {signInMutation.isError ? (
          <Text accessibilityRole="alert" selectable style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && canSubmit && styles.buttonPressed
          ]}
        >
          {signInMutation.isPending ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{t("accountPage.login")}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.accent,
    opacity: 0.1
  },
  form: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.lg
  },
  mark: {
    width: 140,
    height: 120,
    alignSelf: "center"
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    textAlign: "center"
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.size.body,
    paddingHorizontal: spacing.lg
  },
  error: {
    color: colors.error,
    fontSize: typography.size.caption
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: 20
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonPressed: {
    opacity: 0.8
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: typography.size.action,
    fontWeight: typography.weight.bold
  }
});
