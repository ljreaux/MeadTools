export const availableLocales = ["en", "de", "lt"] as const;
export type AvailableLocale = (typeof availableLocales)[number];

export const supportedLocales = ["en", "de"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

export const translationNamespaces = ["default", "YeastTable"] as const;
export type TranslationNamespace = (typeof translationNamespaces)[number];

export const i18nConfig = {
  locales: [...supportedLocales],
  defaultLocale,
};

export type TranslationResource = Record<string, unknown>;
export type TranslationResources = Record<
  string,
  Record<string, TranslationResource>
>;
