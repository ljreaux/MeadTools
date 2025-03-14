import Nav from "@/components/ispindel/Nav";
import { ISpindelProvider } from "@/components/providers/ISpindelProvider";
import initTranslations from "@/lib/i18n";
import React from "react";

async function Layout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const i18nNamespaces = ["default", "YeastTable"];
  const { t } = await initTranslations(locale, i18nNamespaces);
  return (
    <ISpindelProvider>
      <div className="p-12 py-8 rounded-xl bg-background w-11/12 max-w-[1000px] relative">
        <Nav />
        <h1 className="text-3xl text-center">{t("iSpindelDashboard.label")}</h1>
        {children}
      </div>
    </ISpindelProvider>
  );
}

export default Layout;
