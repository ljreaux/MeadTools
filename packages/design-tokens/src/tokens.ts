export const brandColors = {
  honey: "#F5A623",
  ink: "#171717",
  cream: "#FAFAFA"
} as const;

export const colorThemes = {
  light: {
    background: "#D2A34C",
    surface: "#D2A34C",
    surfaceRaised: "#F1F5F9",
    text: "#242424",
    textMuted: "#64748B",
    border: "#E2E8F0",
    accent: brandColors.honey,
    onAccent: brandColors.ink,
    success: "#15803D",
    warning: "#CA8A04",
    error: "#DC2626"
  },
  dark: {
    background: brandColors.ink,
    surface: "#262626",
    surfaceRaised: "#383F44",
    text: brandColors.cream,
    textMuted: "#A3A3A3",
    border: "#525252",
    accent: brandColors.honey,
    onAccent: brandColors.ink,
    success: "#4ADE80",
    warning: "#FACC15",
    error: "#FCA5A5"
  }
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  round: 999
} as const;

export const typography = {
  family: {
    brand: '"Libre Baskerville", serif',
    system:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  size: {
    caption: 14,
    body: 16,
    action: 17,
    title: 28
  },
  weight: {
    regular: "400",
    medium: "500",
    bold: "700"
  }
} as const;

export const designTokens = {
  color: {
    brand: brandColors,
    theme: colorThemes
  },
  spacing,
  radius: radii,
  typography
} as const;

export type ColorTheme = keyof typeof colorThemes;
export type DesignTokens = typeof designTokens;
