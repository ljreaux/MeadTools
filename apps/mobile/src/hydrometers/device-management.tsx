import { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { HydrometerDeviceResponse } from "@meadtools/api-contract";
import { parseHydrometerCoefficients } from "@meadtools/brew-domain/hydrometer-setup";
import { radii, spacing, typography } from "@meadtools/design-tokens";
import { CalculatorScreen, CalculatorField } from "@/components/calculator-ui";
import { useApiClient } from "@/providers/app-providers";
import { useThemeColors } from "@/hooks/useThemeColors";
import { HydrometerActionButton, HydrometerNotice } from "./lifecycle-ui";
import { useHydrometerAction } from "./use-lifecycle";

export function HydrometerDeviceManagement({ device }: { device: HydrometerDeviceResponse }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const api = useApiClient();
  const router = useRouter();
  const action = useHydrometerAction();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const parsed = draft ? parseHydrometerCoefficients(draft) : null;
  const disabled = action.busy || !action.online;
  return (
    <View style={styles.section}>
      <HydrometerNotice failure={action.failure} offline={!action.online} />
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {t("mobileHydrometers.setup.calibrationSaved")}
        </Text>
      ) : null}
      <HydrometerActionButton
        label={t("iSpindelDashboard.updateCoefficients")}
        disabled={disabled}
        onPress={() => {
          action.clearFailure();
          setSaved(false);
          setDraft(
            Array.from({ length: 4 }, (_, index) => device.coefficients[index]?.toString() ?? "")
          );
        }}
      />
      <HydrometerActionButton
        label={t("iSpindelDashboard.deleteDevice")}
        disabled={disabled}
        onPress={() =>
          Alert.alert(
            t("iSpindelDashboard.confirm"),
            t("mobileHydrometers.setup.removeConfirm", {
              device: device.device_name?.trim() || t("mobileHydrometers.unnamedDevice")
            }),
            [
              { text: t("cancel"), style: "cancel" },
              {
                text: t("iSpindelDashboard.deleteDevice"),
                style: "destructive",
                onPress: () => {
                  void (async () => {
                    const result = await action.run(() => api.deleteHydrometerDevice(device.id));
                    if (result) router.replace("/tools/hydrometers");
                  })();
                }
              }
            ]
          )
        }
      />
      {draft ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (!action.busy) setDraft(null);
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <CalculatorScreen>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                {t("mobileHydrometers.coefficients")}
              </Text>
              <Text style={{ color: colors.text }}>
                {t("mobileHydrometers.setup.calibrationHint")}
              </Text>
              <Text style={{ color: colors.text }}>{t("mobileHydrometers.setup.formula")}</Text>
              {draft.map((value, index) => (
                <CalculatorField
                  key={index}
                  label={t(`mobileHydrometers.setup.coefficient${index}`)}
                >
                  <TextInput
                    accessibilityLabel={t(`mobileHydrometers.setup.coefficient${index}`)}
                    value={value}
                    editable={!action.busy}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(next) =>
                      setDraft(
                        (prior) =>
                          prior?.map((item, position) => (position === index ? next : item)) ?? null
                      )
                    }
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </CalculatorField>
              ))}
              {!parsed ? (
                <Text style={{ color: colors.textMuted }}>
                  {t("mobileHydrometers.setup.invalidCoefficients")}
                </Text>
              ) : null}
              <HydrometerNotice failure={action.failure} offline={!action.online} />
              <View style={styles.actions}>
                <HydrometerActionButton
                  label={t(action.busy ? "saving" : "save")}
                  disabled={disabled || !parsed}
                  onPress={() => {
                    if (!parsed) return;
                    void (async () => {
                      const result = await action.run(() =>
                        api.updateHydrometerCoefficients(device.id, parsed)
                      );
                      if (result) {
                        setDraft(null);
                        setSaved(true);
                      }
                    })();
                  }}
                />
                <HydrometerActionButton
                  label={t("cancel")}
                  disabled={action.busy}
                  onPress={() => setDraft(null)}
                />
              </View>
            </CalculatorScreen>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.size.body
  }
});
