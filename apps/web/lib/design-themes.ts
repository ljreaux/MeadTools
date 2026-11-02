// Palettes override shadcn/Tailwind tokens, independently of light/dark mode.
// Each non-classic theme lives in app/themes/<id>.css, scoped to
// html[data-design="<id>"]. Labels are accountPage.designTheme.<id> in the
// i18n locales. See docs/design-themes.md for adding a theme.
export const DESIGN_THEMES = [
  { id: "classic" },
  { id: "nordic" },
  { id: "neon" },
  { id: "hive" },
  { id: "catppuccin" }
] as const;

export type DesignThemeId = (typeof DESIGN_THEMES)[number]["id"];

export const DEFAULT_DESIGN_THEME: DesignThemeId = "classic";
export const DESIGN_THEME_STORAGE_KEY = "mt-design";

export function isDesignThemeId(value: unknown): value is DesignThemeId {
  return DESIGN_THEMES.some((theme) => theme.id === value);
}

// Apply only a known saved design before paint. Classic is the server default;
// blocked storage leaves it unchanged. Mode remains owned by next-themes.
export const designThemeInitScript = `try {
  const design = localStorage.getItem(${JSON.stringify(DESIGN_THEME_STORAGE_KEY)});
  if (${JSON.stringify(DESIGN_THEMES.map(({ id }) => id))}.includes(design)) {
    document.documentElement.setAttribute("data-design", design);
  }
} catch {}`;
