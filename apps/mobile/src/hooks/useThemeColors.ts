import { useColorScheme } from "react-native";
import { colorThemes } from "@meadtools/design-tokens";

type AppColorScheme = "light" | "dark";

export function useThemeColors() {
  const colorScheme = useColorScheme();
  const resolvedColorScheme: AppColorScheme =
    colorScheme === "dark" ? "dark" : "light";
  const colors = colorThemes[resolvedColorScheme];

  return {
    colorScheme,
    resolvedColorScheme,
    colors
  };
}
