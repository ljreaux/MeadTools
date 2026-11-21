import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DatePickerDialog, Host, TimePickerDialog } from "@expo/ui/jetpack-compose";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { withPickedDay, withPickedTime } from "@/brews/date-part";
import { useThemeColors } from "@/hooks/useThemeColors";

export type DateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  disabled?: boolean;
};

/**
 * Android: the date and the time each open Material's picker dialog, since
 * Material has no combined date and time picker. iOS uses
 * `date-time-field.ios.tsx`.
 */
export function DateTimeField({ label, value, onChange, disabled }: DateTimeFieldProps) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { i18n } = useTranslation();
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(value);
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(value);

  const button = (kind: "date" | "time", text: string) => (
    <Pressable
      accessibilityLabel={`${label}: ${text}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setOpen(kind)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {button("date", date)}
      {button("time", time)}
      {open ? (
        <Host>
          {open === "date" ? (
            <DatePickerDialog
              color={colors.accent}
              initialDate={value.toISOString()}
              onDateSelected={(picked) => {
                setOpen(null);
                onChange(withPickedDay(picked, value));
              }}
              onDismissRequest={() => setOpen(null)}
            />
          ) : (
            <TimePickerDialog
              color={colors.accent}
              initialDate={value.toISOString()}
              onDateSelected={(picked) => {
                setOpen(null);
                onChange(withPickedTime(picked, value));
              }}
              onDismissRequest={() => setOpen(null)}
            />
          )}
        </Host>
      ) : null}
    </View>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    button: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.lg
    },
    text: { color: colors.text, fontSize: typography.size.body },
    pressed: { opacity: 0.7 }
  });
}
