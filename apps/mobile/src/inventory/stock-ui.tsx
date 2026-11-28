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
  accessibilityLabel,
  onPress,
  disabled,
  primary,
  destructive,
  grow
}: {
  label: string;
  /** A fuller label for screen readers, such as "Edit Fermenter" for "Edit". */
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  /** Fill half a row, so a group of actions lines up as a two-column grid. */
  grow?: boolean;
}) {
  const styles = useStockStyles();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, grow && styles.grow, primary && styles.primary, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText, destructive && styles.error]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One history entry as a compact row: what happened and the change on top,
 * then the details and any note. Rows share one card, so a list of 100 changes
 * stays readable.
 */
export function StockHistoryRow({ title, value, details, note, first = false }: {
  title: string;
  value?: string | null;
  details: readonly (string | null | undefined | false)[];
  note?: string | null;
  first?: boolean;
}) {
  const styles = useStockStyles();
  const detail = details.filter(Boolean).join(" · ");
  return (
    <View accessible style={[styles.listRow, !first && styles.listDivider]}>
      <View style={styles.listTop}>
        <Text style={[styles.body, styles.listTitle]}>{title}</Text>
        {value ? <Text style={[styles.body, styles.listValue]}>{value}</Text> : null}
      </View>
      {detail ? <Text style={[styles.body, styles.muted, styles.caption]}>{detail}</Text> : null}
      {note ? <Text style={[styles.body, styles.caption]}>{note}</Text> : null}
    </View>
  );
}

/** A tappable row inside a card list, such as a recipe to open. */
export function StockLinkRow({ label, onPress, first = false }: {
  label: string;
  onPress: () => void;
  first?: boolean;
}) {
  const styles = useStockStyles();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, styles.listTop, !first && styles.listDivider, pressed && styles.dim]}
    >
      <Text numberOfLines={2} style={[styles.body, styles.listTitle]}>{label}</Text>
      <Text importantForAccessibility="no" style={[styles.body, styles.muted]}>›</Text>
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
    dim: { opacity: 0.55 },
    caption: { fontSize: typography.size.caption },
    listRow: { gap: 2, minHeight: 44, justifyContent: "center", paddingVertical: spacing.sm },
    listDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
    listTop: { alignItems: "center", flexDirection: "row", gap: spacing.md },
    listTitle: { flex: 1 },
    listValue: { fontVariant: ["tabular-nums"], fontWeight: typography.weight.bold },
    rowName: { flex: 1 },
    grow: { flexBasis: "45%", flexGrow: 1 }
  });
}
