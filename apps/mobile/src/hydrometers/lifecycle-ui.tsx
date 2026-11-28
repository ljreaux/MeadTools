import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  hydrometerBrewName,
  searchHydrometerChoices,
  type HydrometerChoice
} from "@meadtools/brew-domain/hydrometer-lifecycle";
import { radii, spacing, typography } from "@meadtools/design-tokens";
import { CalculatorScreen } from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";

export function HydrometerActionButton({
  label,
  onPress,
  disabled = false
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function HydrometerNotice({
  failure,
  offline
}: {
  failure: "offline" | "session" | "changed" | "failed" | null;
  offline?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  if (!failure && !offline) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: failure ? colors.error : colors.textMuted }}
    >
      {t(`mobileHydrometers.lifecycle.errors.${failure ?? "offline"}`)}
    </Text>
  );
}

export function HydrometerChoiceSheet({
  title,
  choices,
  loading,
  error,
  onChoose,
  onClose,
  onRetry
}: {
  title: string;
  choices: readonly HydrometerChoice[];
  loading?: boolean;
  error?: boolean;
  onChoose: (id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => searchHydrometerChoices(choices, search), [choices, search]);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          data={error ? [] : filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.section}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>
              <HydrometerActionButton label={t("cancel")} onPress={onClose} />
              <TextInput
                accessibilityLabel={t("searchLabel")}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("searchLabel")}
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              {loading ? <ActivityIndicator color={colors.accent} /> : null}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.section}>
                <Text style={{ color: colors.textMuted }}>
                  {t(
                    error ? "mobileHydrometers.errorBody" : "mobileHydrometers.lifecycle.noChoices"
                  )}
                </Text>
                {error ? (
                  <HydrometerActionButton
                    label={t("mobileHydrometers.refresh")}
                    onPress={onRetry}
                  />
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: item.disabled }}
              disabled={item.disabled}
              onPress={() => onChoose(item.id)}
              style={[
                styles.choice,
                { borderColor: colors.border, opacity: item.disabled ? 0.5 : 1 }
              ]}
            >
              <Text style={[styles.label, { color: colors.text }]}>{item.name}</Text>
              {item.description ? (
                <Text style={{ color: colors.textMuted }}>{item.description}</Text>
              ) : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

export function HydrometerNameSheet({
  title,
  initialName = "",
  busy,
  online,
  failure,
  onSubmit,
  onClose
}: {
  title: string;
  initialName?: string;
  busy: boolean;
  online: boolean;
  failure: "offline" | "session" | "changed" | "failed" | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [name, setName] = useState(initialName);
  const validName = hydrometerBrewName(name);
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <CalculatorScreen>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.label, { color: colors.text }]}>
            {t("mobileHydrometers.lifecycle.brewName")}
          </Text>
          <TextInput
            accessibilityLabel={t("mobileHydrometers.lifecycle.brewName")}
            editable={!busy}
            autoCorrect={false}
            returnKeyType="done"
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => {
              if (validName && !busy && online) onSubmit(validName);
            }}
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          {!validName ? (
            <Text style={{ color: colors.textMuted }}>
              {t("mobileHydrometers.lifecycle.nameRequired")}
            </Text>
          ) : null}
          <HydrometerNotice failure={failure} offline={!online} />
          <View style={styles.actions}>
            <HydrometerActionButton
              label={t(busy ? "saving" : "save")}
              disabled={busy || !online || !validName}
              onPress={() => {
                if (validName) onSubmit(validName);
              }}
            />
            <HydrometerActionButton label={t("cancel")} disabled={busy} onPress={onClose} />
          </View>
        </CalculatorScreen>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  section: { gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold },
  label: { fontSize: typography.size.body, fontWeight: typography.weight.bold },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: 48,
    padding: spacing.md,
    fontSize: typography.size.body
  },
  choice: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 52,
    gap: spacing.sm
  },
  button: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: 44,
    padding: spacing.md,
    justifyContent: "center"
  }
});
