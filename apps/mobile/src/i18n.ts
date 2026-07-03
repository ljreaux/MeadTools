import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import {
  defaultLocale,
  supportedLocales as sharedSupportedLocales,
  translationNamespaces,
  type AvailableLocale,
  type SupportedLocale,
  type TranslationNamespace,
  type TranslationResources
} from "@meadtools/i18n";

import { loadTranslationResource } from "@meadtools/i18n/resources";

const supportedLocales = sharedSupportedLocales;
const fallbackLocale = defaultLocale;
const namespaces = translationNamespaces;
const defaultNamespace = "default" satisfies TranslationNamespace;

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

function getInitialLocale(): SupportedLocale {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;

  if (deviceLanguageCode && isSupportedLocale(deviceLanguageCode)) {
    return deviceLanguageCode;
  }

  return fallbackLocale;
}

async function loadResourcesForLocale(
  locale: AvailableLocale
): Promise<Record<TranslationNamespace, unknown>> {
  const resourceEntries = await Promise.all(
    namespaces.map(async (namespace) => {
      const resource = await loadTranslationResource(locale, namespace);

      return [namespace, resource] as const;
    })
  );

  return Object.fromEntries(resourceEntries) as Record<
    TranslationNamespace,
    unknown
  >;
}

export async function initI18n() {
  const lng = getInitialLocale();
  const localesToLoad = Array.from(new Set([fallbackLocale, lng]));

  const resources = Object.fromEntries(
    await Promise.all(
      localesToLoad.map(async (locale) => {
        const localeResources = await loadResourcesForLocale(locale);

        return [locale, localeResources] as const;
      })
    )
  ) as TranslationResources;

  await i18n.use(initReactI18next).init({
    lng,
    fallbackLng: fallbackLocale,
    ns: namespaces,
    defaultNS: defaultNamespace,
    resources,
    interpolation: {
      escapeValue: false
    },
    compatibilityJSON: "v4"
  });

  return i18n;
}

export default i18n;
