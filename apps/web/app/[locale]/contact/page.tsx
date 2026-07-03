import ContactForm from "@/components/ContactForm";
import initTranslations from "@/lib/i18n";

export default async function ContactPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ["default", "YeastTable"]);
  return (
    <div className="w-full flex justify-center items-center sm:pt-24 pt-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1200px]">
        <h1 className="text-3xl font-bold mb-4"> {t("contactHeading")}</h1>
        <ContactForm />
      </div>
    </div>
  );
}
