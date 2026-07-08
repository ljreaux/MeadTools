import { useColorScheme, Appearance, type ColorSchemeName } from "react-native";
import { colorThemes } from "@meadtools/design-tokens";

type AppColorScheme = "light" | "dark";

export function useThemeColors() {
  const colorScheme = useColorScheme();
  const resolvedColorScheme: AppColorScheme =
    colorScheme === "dark" ? "dark" : "light";
  const colors = colorThemes[resolvedColorScheme];

  const changeColorScheme = (colorScheme: ColorSchemeName): void => {
    Appearance.setColorScheme(colorScheme);
  };

  const useSystemColorScheme = (): void => {
    changeColorScheme("unspecified");
  };

  const toggleColorScheme = (): void => {
    const newScheme = resolvedColorScheme === "dark" ? "light" : "dark";
    changeColorScheme(newScheme);
  };

  return {
    colorScheme,
    resolvedColorScheme,
    colors,
    changeColorScheme,
    toggleColorScheme,
    useSystemColorScheme
  };
}
