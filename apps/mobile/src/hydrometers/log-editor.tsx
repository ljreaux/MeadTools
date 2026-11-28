import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  HydrometerLogResponse,
  UpdateHydrometerLogRequestBody
} from "@meadtools/api-contract";
import { convertReadingTemperature } from "@meadtools/brew-domain/hydrometer";
import { spacing } from "@meadtools/design-tokens";
import {
  CalculatorField,
  CalculatorScreen,
  DecimalInput,
  Segmented
} from "@/components/calculator-ui";
import { DateTimeField } from "@/components/date-time-field";
import { useThemeColors } from "@/hooks/useThemeColors";
import { logDraft, logNumberFields, parseLogDraft } from "./log-draft";

export function HydrometerLogEditor({
  log,
  onClose,
  onSave,
  busy,
  error
}: {
  log: HydrometerLogResponse;
  onClose: () => void;
  onSave: (input: UpdateHydrometerLogRequestBody) => void;
  busy: boolean;
  error: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [draft, setDraft] = useState(() => logDraft(log));
  const parsed = parseLogDraft(draft);
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <CalculatorScreen>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24 }}>
          {t("mobileHydrometers.editLog")}
        </Text>
        <DateTimeField
          label={t("mobileHydrometers.readingTime")}
          value={new Date(draft.dateTime)}
          disabled={busy}
          onChange={(date) => setDraft((prior) => ({ ...prior, dateTime: date.toISOString() }))}
        />
        {logNumberFields.map((field) => (
          <CalculatorField key={field} label={t(`mobileHydrometers.fields.${field}`)}>
            <DecimalInput
              label={t(`mobileHydrometers.fields.${field}`)}
              value={draft[field]}
              onChangeText={(value) => setDraft((prior) => ({ ...prior, [field]: value }))}
            />
          </CalculatorField>
        ))}
        <Segmented
          label={t("temperature")}
          options={["C", "F"]}
          value={draft.temp_units}
          onChange={(value) => setDraft((prior) => {
            const temperature = Number(prior.temperature.replace(",", "."));
            return { ...prior, temp_units: value, temperature: prior.temperature.trim() && Number.isFinite(temperature) ? String(convertReadingTemperature(temperature, prior.temp_units, value)) : prior.temperature };
          })}
          optionLabel={(option) => `°${option}`}
        />
        {!parsed ? (
          <Text style={{ color: colors.error }}>{t("mobileHydrometers.invalidLog")}</Text>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>
            {t("mobileHydrometers.saveError")}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !parsed }}
            disabled={busy || !parsed}
            style={{
              padding: spacing.md,
              minHeight: 44,
              backgroundColor: colors.accent,
              opacity: busy || !parsed ? 0.5 : 1
            }}
            onPress={() => {
              if (parsed) onSave(parsed);
            }}
          >
            <Text style={{ color: colors.onAccent }}>{t(busy ? "saving" : "save")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={{ padding: spacing.md, minHeight: 44 }}
            onPress={onClose}
          >
            <Text style={{ color: colors.text }}>{t("cancel")}</Text>
          </Pressable>
        </View>
      </CalculatorScreen>
    </Modal>
  );
}
