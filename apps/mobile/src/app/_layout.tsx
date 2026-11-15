import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";

import { useThemeColors } from "@/hooks/useThemeColors";
import i18n, { initI18n } from "@/i18n";
import { BrewEntryOutboxProvider } from "@/outbox/entry-outbox-provider";
import { AppProviders, useSession } from "@/providers/app-providers";

function RootNavigator() {
  const { status } = useSession();
  const { colors, resolvedColorScheme } = useThemeColors();
  const baseTheme = resolvedColorScheme === "dark" ? DarkTheme : DefaultTheme;
  // Native headers and tab content follow the MeadTools palette.
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      border: colors.border,
      card: colors.surface,
      notification: colors.error,
      primary: colors.accent,
      text: colors.text
    }
  };

  if (status === "loading") {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "unauthenticated"}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "authenticated"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void initI18n().then(() => {
      setI18nReady(true);
    });
  }, []);

  if (!i18nReady) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <AppProviders>
        <BrewEntryOutboxProvider>
          <RootNavigator />
        </BrewEntryOutboxProvider>
      </AppProviders>
    </I18nextProvider>
  );
}
