import { createInstance, i18n, TFunction } from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import resourcesToBackend from "i18next-resources-to-backend";
import i18nConfig from "@/i18nConfig";

// Define the structure of translation resources
type Resources = {
  [language: string]: {
    [namespace: string]: {
      [key: string]: string;
    };
  };
};

// Define return type for the initialization function
interface InitTranslationsReturn {
  i18n: i18n;
  resources: Resources;
  t: TFunction;
}

export default async function initTranslations(
  locale: string,
  namespaces: string[],
  i18nInstance?: i18n,
  resources?: Resources
): Promise<InitTranslationsReturn> {
  i18nInstance = i18nInstance || createInstance();

  i18nInstance.use(initReactI18next);

  if (!resources) {
    i18nInstance.use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`@/locales/${language}/${namespace}.json`)
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
    resources: i18nInstance.services.resourceStore.data as Resources,
    t: i18nInstance.t,
  };
}
