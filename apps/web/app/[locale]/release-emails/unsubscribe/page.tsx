import initTranslations from "@/lib/i18n";
import ReleaseEmailUnsubscribeForm from "@/components/account/ReleaseEmailUnsubscribeForm";

const products = ["web", "mobile", "chat", "api"] as const;

export default async function ReleaseEmailUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    token?: string | string[];
    product?: string | string[];
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const { t } = await initTranslations(locale, ["default"]);
  const token = typeof query.token === "string" ? query.token : "";
  const product =
    typeof query.product === "string"
      ? products.find((item) => item === query.product)
      : undefined;
  const valid = /^[a-f0-9]{64}$/.test(token) && product;

  return (
    <main className="mx-auto w-11/12 max-w-[700px] pb-28 pt-32">
      <div className="rounded-xl bg-background p-8 md:p-12">
        <h1 className="mb-4 text-3xl font-bold">
          {t("releaseEmails.unsubscribeTitle")}
        </h1>
        {valid ? (
          <ReleaseEmailUnsubscribeForm token={token} product={product} />
        ) : (
          <p role="alert">{t("releaseEmails.unsubscribeInvalid")}</p>
        )}
      </div>
    </main>
  );
}
