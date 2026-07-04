import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";

import i18n, { initI18n } from "@/i18n";
import { AppProviders } from "@/providers/app-providers";

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <StatusBar style="light" />
      </AppProviders>
    </I18nextProvider>
  );
}
