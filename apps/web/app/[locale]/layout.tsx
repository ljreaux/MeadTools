import Navbar from "@/components/navbar/Navbar";
import Providers from "@/components/providers/Providers";
import TranslationsProvider from "@/components/providers/TranslationsProvider";
import initTranslations from "@/lib/i18n";
import { Suspense } from "react";
import Loading from "../../components/loading";
import BottomBar from "@/components/navbar/BottomBar";
import KofiButton from "@/components/KofiSupportButton";
import { BannerStack } from "@/components/ui/banner";
import Dialogs from "@/components/dialogs/Dialogs";

export default async function Layout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const i18nNamespaces = ["default", "YeastTable"];
  const { resources } = await initTranslations(locale, i18nNamespaces);
  return (
    <TranslationsProvider
      namespaces={i18nNamespaces}
      locale={locale}
      resources={resources}
    >
      <Providers>
        <Navbar />
        <div className="fixed top-20 left-0 right-0 z-[2000]">
          <BannerStack max={3} />
        </div>
        <Suspense fallback={<Loading />}>{children}</Suspense>
        <BottomBar />
        <KofiButton />
        <Dialogs />
      </Providers>
    </TranslationsProvider>
  );
}
