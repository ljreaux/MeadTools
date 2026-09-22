import {
  i18nConfig,
  type SupportedLocale,
} from "@meadtools/i18n";

export function getLocalizedPathname(
  pathname: string,
  targetLocale: SupportedLocale,
) {
  const segments = pathname.split("/");
  const hasLocalePrefix = i18nConfig.locales.some(
    (locale) => segments[1] === locale,
  );
  const pathnameWithoutLocale = hasLocalePrefix
    ? `/${segments.slice(2).join("/")}`
    : pathname;
  const normalizedPathname = pathnameWithoutLocale || "/";

  if (targetLocale === i18nConfig.defaultLocale) {
    return normalizedPathname;
  }

  return normalizedPathname === "/"
    ? `/${targetLocale}`
    : `/${targetLocale}${normalizedPathname}`;
}
