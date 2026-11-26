import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";

export function useStockStyles() {
  return createStyles(useThemeColors().colors);
}

export function StockCard({ children }: { children: ReactNode }) {
  const styles = useStockStyles();
  return <View style={styles.card}>{children}</View>;
}

export function StockText({
  children,
  kind = "body"
}: {
  children: ReactNode;
  kind?: "body" | "heading" | "muted" | "error";
}) {
  const styles = useStockStyles();
  return (
    <Text
      accessibilityRole={kind === "heading" ? "header" : undefined}
      accessibilityLiveRegion={kind === "error" ? "polite" : undefined}
      style={[styles.body, styles[kind]]}
    >
      {children}
    </Text>
  );
}

export function StockInput(props: TextInputProps) {
  const { colors } = useThemeColors();
  const styles = useStockStyles();
  return <TextInput placeholderTextColor={colors.placeholder} style={styles.input} {...props} />;
}

export function StockButton({
  label,
  onPress,
  disabled,
  primary,
  destructive
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
}) {
  const styles = useStockStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText, destructive && styles.error]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg
    },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    body: { color: colors.text, fontSize: typography.size.body },
    heading: { fontWeight: typography.weight.bold, fontSize: typography.size.action },
    muted: { color: colors.textMuted },
    error: { color: colors.error },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    button: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    buttonText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    primary: { backgroundColor: colors.accent, borderColor: colors.accent },
    primaryText: { color: colors.onAccent },
    dim: { opacity: 0.55 }
  });
}
