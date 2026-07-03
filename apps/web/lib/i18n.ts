import { createInstance, i18n, TFunction } from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import resourcesToBackend from "i18next-resources-to-backend";
import {
  i18nConfig,
  type TranslationResources,
} from "@meadtools/i18n";
import { loadTranslationResource } from "@meadtools/i18n/resources";

// Define return type for the initialization function
interface InitTranslationsReturn {
  i18n: i18n;
  resources: TranslationResources;
  t: TFunction;
}

export default async function initTranslations(
  locale: string,
  namespaces: string[],
  i18nInstance?: i18n,
  resources?: TranslationResources
): Promise<InitTranslationsReturn> {
  i18nInstance = i18nInstance || createInstance();

  i18nInstance.use(initReactI18next);

  if (!resources) {
    i18nInstance.use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          loadTranslationResource(language, namespace)
      )
    );
  }

  await i18nInstance.init({
    lng: locale,
    resources,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: namespaces[0],
    fallbackNS: namespaces[0],
    ns: namespaces,
    preload: resources ? [] : i18nConfig.locales,
  });

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore
      .data as TranslationResources,
    t: i18nInstance.t,
  };
}
