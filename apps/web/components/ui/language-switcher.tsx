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
import i18nConfig from "@/i18nConfig";
function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLocale = i18n.language;
  const router = useRouter();
  const currentPathname = usePathname();
  return (
    <Select
      value={i18n.resolvedLanguage}
      onValueChange={(val) => {
        i18n.changeLanguage(val);
        // set cookie for next-i18n-router
        const days = 30;
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        const expires = date.toUTCString();
        document.cookie = `NEXT_LOCALE=${val};expires=${expires};path=/`;

        // redirect to the new locale path
        if (
          currentLocale === i18nConfig.defaultLocale &&
          !i18nConfig.defaultLocale
        ) {
          router.push("/" + val + currentPathname);
        } else {
          router.push(currentPathname.replace(`/${currentLocale}`, `/${val}`));
        }

        router.refresh();
      }}
    >
      <SelectTrigger className="w-full ">
        <SelectValue placeholder="EN" />
      </SelectTrigger>
      <SelectContent className="z-[2000]">
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
