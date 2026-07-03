"use client";

import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import initTranslations from "@/lib/i18n";
import { createInstance } from "i18next";

type Resources = {
  [language: string]: {
    [namespace: string]: {
      [key: string]: string;
    };
  };
};

interface TranslationsProviderProps {
  children: ReactNode;
  locale: string;
  namespaces: string[];
  resources?: Resources;
}

export default function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources,
}: TranslationsProviderProps) {
  const i18n = createInstance();

  initTranslations(locale, namespaces, i18n, resources);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
