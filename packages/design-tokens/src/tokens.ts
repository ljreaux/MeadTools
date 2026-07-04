export const webColorChannels = {
  light: {
    background: "38, 54%, 56%",
    foreground: "0, 0%, 14%",
    card: "38, 54%, 56%",
    cardForeground: "0, 0%, 14%",
    popover: "38, 54%, 56%",
    popoverForeground: "0, 0%, 14%",
    primary: "222.2, 47.4%, 11.2%",
    primaryForeground: "36, 16%, 82%",
    secondary: "210, 40%, 96.1%",
    secondaryForeground: "222.2, 47.4%, 11.2%",
    muted: "210, 40%, 96.1%",
    mutedForeground: "215.4, 16.3%, 46.9%",
    accent: "210, 40%, 96.1%",
    accentForeground: "222.2, 47.4%, 11.2%",
    destructive: "0, 84.2%, 60.2%",
    destructiveForeground: "36, 16%, 82%",
    warning: "45, 100%, 50%",
    warningForeground: "36, 16%, 82%",
    border: "214.3, 31.8%, 91.4%",
    input: "214.3, 31.8%, 91.4%",
    ring: "0, 0%, 14%",
    chart1: "12, 76%, 61%",
    chart2: "173, 58%, 39%",
    chart3: "197, 37%, 24%",
    chart4: "43, 74%, 66%",
    chart5: "27, 87%, 67%"
  },
  dark: {
    background: "0, 0%, 14%",
    foreground: "36, 16%, 82%",
    card: "0, 0%, 14%",
    cardForeground: "36, 16%, 82%",
    popover: "0, 0%, 14%",
    popoverForeground: "36, 16%, 82%",
    primary: "36, 16%, 82%",
    primaryForeground: "222.2, 47.4%, 11.2%",
    secondary: "210, 13%, 35%",
    secondaryForeground: "36, 16%, 82%",
    muted: "210, 40%, 96.1%",
    mutedForeground: "215, 20.2%, 65.1%",
    accent: "210, 13%, 35%",
    accentForeground: "36, 16%, 82%",
    destructive: "0, 62.8%, 30.6%",
    destructiveForeground: "36, 16%, 82%",
    warning: "45, 90%, 40%",
    warningForeground: "36, 16%, 82%",
    border: "210, 13%, 35%",
    input: "210, 13%, 35%",
    ring: "212.7, 26.8%, 83.9%",
    chart1: "220, 70%, 50%",
    chart2: "160, 60%, 45%",
    chart3: "30, 80%, 55%",
    chart4: "280, 65%, 60%",
    chart5: "340, 75%, 55%"
  }
} as const;

export type ColorTheme = keyof typeof webColorChannels;

export function hslColor(channels: string) {
  return `hsl(${channels})`;
}

function createSemanticTheme(theme: ColorTheme) {
  const colors = webColorChannels[theme];

  return {
    background: hslColor(colors.background),
    surface: hslColor(colors.card),
    surfaceRaised: hslColor(colors.secondary),
    text: hslColor(colors.foreground),
    textMuted: hslColor(colors.mutedForeground),
    border: hslColor(colors.border),
    accent: hslColor(colors.primary),
    onAccent: hslColor(colors.primaryForeground),
    success: hslColor(theme === "light" ? "142, 72%, 29%" : "142, 69%, 58%"),
    warning: hslColor(colors.warning),
    error: hslColor(colors.destructive)
  } as const;
}

export const colorThemes = {
  light: createSemanticTheme("light"),
  dark: createSemanticTheme("dark")
} as const;

export const brandColors = {
  honey: hslColor(webColorChannels.light.background),
  ink: hslColor(webColorChannels.dark.background),
  cream: hslColor(webColorChannels.dark.foreground)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const baseRadiusRem = 0.5;

export const radii = {
  sm: baseRadiusRem * 16,
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
    theme: colorThemes,
    webChannels: webColorChannels
  },
  web: {
    radius: `${baseRadiusRem}rem`
  },
  spacing,
  radius: radii,
  typography
} as const;

export type DesignTokens = typeof designTokens;
