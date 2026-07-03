import type {
  AvailableLocale,
  TranslationNamespace,
  TranslationResource,
} from "./index.ts";

type ResourceLoader = () => Promise<TranslationResource>;

const resourceLoaders: Record<
  AvailableLocale,
  Record<TranslationNamespace, ResourceLoader>
> = {
  en: {
    default: () =>
      import("../locales/en/default.json").then((module) => module.default),
    YeastTable: () =>
      import("../locales/en/YeastTable.json").then((module) => module.default),
  },
  de: {
    default: () =>
      import("../locales/de/default.json").then((module) => module.default),
    YeastTable: () =>
      import("../locales/de/YeastTable.json").then((module) => module.default),
  },
  lt: {
    default: () =>
      import("../locales/lt/default.json").then((module) => module.default),
    YeastTable: () =>
      import("../locales/lt/YeastTable.json").then((module) => module.default),
  },
};

export function loadTranslationResource(
  locale: string,
  namespace: string,
): Promise<TranslationResource> {
  const localeLoaders =
    resourceLoaders[locale as keyof typeof resourceLoaders];
  const loader =
    localeLoaders?.[namespace as keyof typeof localeLoaders];

  if (!loader) {
    return Promise.reject(
      new Error(
        `No translation resource exists for locale "${locale}" and namespace "${namespace}".`,
      ),
    );
  }

  return loader();
}
