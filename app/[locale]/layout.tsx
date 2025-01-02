import Navbar from "@/components/navbar/Navbar";
import Providers from "@/components/providers/Providers";
import TranslationsProvider from "@/components/providers/TranslationsProvider";
import initTranslations from "@/lib/i18n";
import { Suspense } from "react";
import Loading from "../../components/loading";
import BottomBar from "@/components/navbar/BottomBar";

export default async function Layout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const i18nNamespaces = ["default", "YeastTable"];
  const { t, resources } = await initTranslations(locale, i18nNamespaces);
  return (
    <TranslationsProvider
      namespaces={i18nNamespaces}
      locale={locale}
      resources={resources}
    >
      <Providers>
        <Navbar t={t} />
        <Suspense fallback={<Loading />}>{children}</Suspense>
        <BottomBar />
      </Providers>
    </TranslationsProvider>
  );
}
