// Design themes are full visual redesigns, independent of light/dark mode.
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

// Runs before hydration to apply the stored design without a flash.
// `?design=<id>` overrides (and persists) the stored value.
export const designThemeInitScript = `(function(){try{
var ids=${JSON.stringify(DESIGN_THEMES.map((theme) => theme.id))};
var key=${JSON.stringify(DESIGN_THEME_STORAGE_KEY)};
var fromQuery=new URLSearchParams(location.search).get("design");
var stored=null;try{stored=localStorage.getItem(key);}catch(e){}
var design=ids.indexOf(fromQuery)>-1?fromQuery:ids.indexOf(stored)>-1?stored:${JSON.stringify(DEFAULT_DESIGN_THEME)};
if(design===fromQuery){try{localStorage.setItem(key,design);}catch(e){}}
document.documentElement.setAttribute("data-design",design);
}catch(e){}})();`;
