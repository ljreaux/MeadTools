import Header from "@/components/account/header";
import Nav from "@/components/ispindel/Nav";
import initTranslations from "@/lib/i18n";
import { PagePanel } from "@/components/PagePanel";

async function Layout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const i18nNamespaces = ["default", "YeastTable"];
  const { t } = await initTranslations(locale, i18nNamespaces);
  return (
    <PagePanel className="w-11/12 max-w-[1200px] relative px-4 py-6 sm:px-12 sm:py-8">
      <Header />
      <h1 className="text-3xl text-center my-2 sm:mt-6 mt-12">
        {t("iSpindelDashboard.label")}
      </h1>
      <Nav />
      {children}
    </PagePanel>
  );
}

export default Layout;
