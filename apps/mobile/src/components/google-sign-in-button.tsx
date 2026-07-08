import { useMutation } from "@tanstack/react-query";
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse
} from "react-native-nitro-google-signin";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text
} from "react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  colorThemes,
  radii,
  spacing,
  typography
} from "@meadtools/design-tokens";

import { googleAuthClientIds } from "@/config/google-auth";
import { useSession } from "@/providers/app-providers";

const colors = colorThemes.dark;

export function GoogleSignInButton() {
  const { t } = useTranslation();
  const { signInWithGoogle } = useSession();
  const [nativeError, setNativeError] = useState(false);
  const {
    isError,
    isPending,
    mutateAsync: exchangeGoogleToken
  } = useMutation({
    mutationFn: signInWithGoogle
  });

  async function handleGoogleSignIn() {
    setNativeError(false);
    const webClientId = googleAuthClientIds.webClientId;

    if (!webClientId) {
      throw new Error("Google web OAuth client ID is not configured");
    }

    GoogleOneTapSignIn.configure({
      webClientId,
      iosClientId: googleAuthClientIds.iosClientId,
      offlineAccess: false
    });

    if (Platform.OS === "android") {
      await GoogleOneTapSignIn.checkPlayServices();
    }

    const response = await GoogleOneTapSignIn.presentExplicitSignIn();

    if (isCancelledResponse(response)) {
      return;
    }

    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error("Google did not return an ID token");
    }

    await exchangeGoogleToken(response.data.idToken);
  }

  function startGoogleSignIn() {
    void handleGoogleSignIn().catch(() => {
      setNativeError(true);
    });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={isPending}
        onPress={startGoogleSignIn}
        style={({ pressed }) => [
          styles.button,
          isPending && styles.buttonDisabled,
          pressed && !isPending && styles.buttonPressed
        ]}
      >
        {isPending ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>
            {t("auth.googleLogin.action")}
          </Text>
        )}
      </Pressable>
      {isError || nativeError ? (
        <Text accessibilityRole="alert" selectable style={styles.error}>
          {t("auth.googleLogin.error")}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 20
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonPressed: {
    opacity: 0.8
  },
  buttonText: {
    color: colors.text,
    fontSize: typography.size.action,
    fontWeight: typography.weight.bold
  },
  error: {
    color: colors.error,
    fontSize: typography.size.caption,
    paddingTop: spacing.sm
  }
});
