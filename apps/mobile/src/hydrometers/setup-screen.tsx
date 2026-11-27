import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { hydrometerSetupAddresses } from "@meadtools/brew-domain/hydrometer-setup";
import { spacing, typography } from "@meadtools/design-tokens";
import { CalculatorScreen, Segmented } from "@/components/calculator-ui";
import { apiBaseUrl, webPageUrl } from "@/config/api";
import { useApiClient } from "@/providers/app-providers";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useIsOnline } from "@/hooks/useIsOnline";
import { HydrometerActionButton } from "./lifecycle-ui";
import { createHydrometerTokenSession, type HydrometerTokenState } from "./token-session";

export function HydrometerSetupScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const api = useApiClient();
  const online = useIsOnline();
  const [device, setDevice] = useState<"iSpindel" | "tilt" | "pill">("iSpindel");
  const [state, setState] = useState<HydrometerTokenState>({
    token: undefined,
    busy: false,
    failed: false
  });
  const [secret] = useState(() => createHydrometerTokenSession(setState));
  const focused = useRef(false);
  const [handoffFailed, setHandoffFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      secret.activate();
      return () => {
        focused.current = false;
        secret.hide();
      };
    }, [secret])
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") secret.hide();
      else if (focused.current) secret.activate();
    });
    return () => listener.remove();
  }, [secret]);
  const addresses = hydrometerSetupAddresses(apiBaseUrl, state.token);
  const text = { color: colors.text, fontSize: typography.size.body };
  function load(generate: boolean) {
    if (!focused.current || AppState.currentState !== "active" || !online) return;
    secret.activate();
    void secret.load(() =>
      generate ? api.generateHydrometerSetupToken() : api.getHydrometerSetupToken()
    );
  }
  return (
    <CalculatorScreen>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t("mobileHydrometers.setup.title")}
      </Text>
      <Segmented
        label={t("mobileHydrometers.setup.deviceType")}
        options={["iSpindel", "tilt", "pill"]}
        value={device}
        onChange={setDevice}
        optionLabel={(value) => t(`iSpindelDashboard.tabs.${value}`)}
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
          {t("mobileHydrometers.setup.token")}
        </Text>
        <Text style={text}>{t("mobileHydrometers.setup.tokenHint")}</Text>
        {state.token ? (
          <Text selectable style={text}>
            {state.token}
          </Text>
        ) : (
          <Text style={text}>
            {t(
              state.token === null
                ? "mobileHydrometers.setup.noToken"
                : "mobileHydrometers.setup.hidden"
            )}
          </Text>
        )}
        {state.failed ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>
            {t("mobileHydrometers.setup.failed")}
          </Text>
        ) : null}
        {!online ? (
          <Text style={text}>{t("mobileHydrometers.lifecycle.errors.offline")}</Text>
        ) : null}
        <View style={styles.actions}>
          {state.token === undefined ? (
            <HydrometerActionButton
              label={t(state.busy ? "loading" : "mobileHydrometers.setup.reveal")}
              disabled={state.busy || !online}
              onPress={() => load(false)}
            />
          ) : (
            <>
              <HydrometerActionButton
                label={t("mobileHydrometers.setup.hide")}
                onPress={() => secret.hide()}
              />
              <HydrometerActionButton
                label={t("iSpindelDashboard.genToken")}
                disabled={state.busy || !online}
                onPress={() =>
                  Alert.alert(
                    t("iSpindelDashboard.genToken"),
                    t("mobileHydrometers.setup.generateConfirm"),
                    [
                      { text: t("cancel"), style: "cancel" },
                      { text: t("iSpindelDashboard.genToken"), onPress: () => load(true) }
                    ]
                  )
                }
              />
            </>
          )}
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        {t(`iSpindelDashboard.tabs.${device}`)}
      </Text>
      {device === "iSpindel" ? (
        <>
          <Text style={text}>{t("mobileHydrometers.setup.iSpindel")}</Text>
          <Text style={text}>{t("iSpindelDashboard.buttonText.server")}</Text>
          <Text selectable style={text}>
            {addresses.server}
          </Text>
          <Text style={text}>{t("iSpindelDashboard.buttonText.path")}</Text>
          <Text selectable style={text}>
            {addresses.iSpindelPath}
          </Text>
          <Text style={text}>{t("iSpindelDashboard.setup.serviceType")}</Text>
        </>
      ) : device === "tilt" ? (
        <>
          <Text style={text}>{t("tilt.instructions.text")}</Text>
          {addresses.tilt ? (
            <Text selectable style={text}>
              {addresses.tilt}
            </Text>
          ) : (
            <Text style={text}>{t("mobileHydrometers.setup.revealUrl")}</Text>
          )}
          <Text style={text}>{t("tilt.instructions.note")}</Text>
        </>
      ) : (
        <>
          <Text style={text}>{t("rapt.cloud.description")}</Text>
          <Text style={text}>{t("mobileHydrometers.setup.raptCloud")}</Text>
          {addresses.raptCloud ? (
            <Text selectable style={text}>
              {addresses.raptCloud}
            </Text>
          ) : (
            <Text style={text}>{t("mobileHydrometers.setup.revealUrl")}</Text>
          )}
          <Text style={text}>{t("rapt.cloud.importantNote")}</Text>
          <Text style={text}>{t("mobileHydrometers.setup.raptBluetooth")}</Text>
        </>
      )}
      <HydrometerActionButton
        label={t("mobileHydrometers.setup.openWeb")}
        onPress={() => {
          secret.hide();
          setHandoffFailed(false);
          void Linking.openURL(webPageUrl("/account/hydrometer/setup")).catch(() =>
            setHandoffFailed(true)
          );
        }}
      />
      {handoffFailed ? (
        <Text style={{ color: colors.error }}>{t("mobileHydrometers.setup.handoffFailed")}</Text>
      ) : null}
    </CalculatorScreen>
  );
}
const styles = StyleSheet.create({
  section: { gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold },
  label: { fontSize: typography.size.body, fontWeight: typography.weight.bold }
});
