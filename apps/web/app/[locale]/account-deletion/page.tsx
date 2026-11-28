import ContactForm from "@/components/ContactForm";
import initTranslations from "@/lib/i18n";

export default async function AccountDeletionPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ["default"]);

  return (
    <main className="relative flex w-full justify-center pt-[6rem] sm:pt-24">
      <section className="flex w-11/12 max-w-[720px] flex-col gap-5 rounded-xl bg-background p-6 md:p-12">
        <h1 className="text-3xl font-bold">{t("accountDeletion.title")}</h1>
        <p className="text-muted-foreground">{t("accountDeletion.verification")}</p>
        <p className="text-muted-foreground">{t("accountDeletion.timing")}</p>
        <ContactForm purpose="account-deletion" />
      </section>
    </main>
  );
}
