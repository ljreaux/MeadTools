"use client";
import {
  SelectValue,
  SelectTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./select";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import {
  i18nConfig,
  type SupportedLocale,
} from "@meadtools/i18n";
import { getLocalizedPathname } from "@/lib/utils/i18nRouting";

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const currentPathname = usePathname();

  const changeLocale = (locale: SupportedLocale) => {
    if (locale === i18n.resolvedLanguage) return;

    document.cookie = `NEXT_LOCALE=${locale};max-age=2592000;path=/;samesite=lax`;

    const localizedPathname = getLocalizedPathname(currentPathname, locale);
    const locationSuffix = `${window.location.search}${window.location.hash}`;
    router.replace(`${localizedPathname}${locationSuffix}`);
  };

  return (
    <Select
      value={i18n.resolvedLanguage}
      onValueChange={(value) => changeLocale(value as SupportedLocale)}
    >
      <SelectTrigger className="w-full ">
        <SelectValue placeholder="EN" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {i18nConfig.locales.map((lang) => {
            return (
              <SelectItem key={lang} value={lang}>
                {lang.toUpperCase()}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default LanguageSwitcher;
