import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityLabel, labelsHidden } from "@expo/ui/swift-ui/modifiers";

import { useThemeColors } from "@/hooks/useThemeColors";

import type { DateTimeFieldProps } from "./date-time-field";

/** SwiftUI's compact date and time picker. */
export function DateTimeField({ label, value, onChange, disabled }: DateTimeFieldProps) {
  const { colors, resolvedColorScheme } = useThemeColors();
  return (
    <Host colorScheme={resolvedColorScheme} matchContents seedColor={colors.accent}>
      <DatePicker
        displayedComponents={["date", "hourAndMinute"]}
        modifiers={[labelsHidden(), accessibilityLabel(label)]}
        onDateChange={(date) => {
          if (!disabled) onChange(date);
        }}
        selection={value}
      />
    </Host>
  );
}
