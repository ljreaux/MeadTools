import initTranslations from "@/lib/i18n";
import {
  getDatedReleases,
  legacyReleases,
  releaseProducts,
} from "@/lib/release-notes";
import LegacyFour from "@/content/release-notes.mdx";
import LegacyThreeFive from "@/content/legacy/release-notes-3.5.mdx";
import Link from "next/link";
import { notFound } from "next/navigation";

const legacyContent = { "v4-0": LegacyFour, "v3-5": LegacyThreeFive };

export default async function ReleaseNote({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { t } = await initTranslations(locale, ["default"]);
  const release = (await getDatedReleases()).find(({ date }) => date === slug);
  const LegacyContent = legacyContent[slug as keyof typeof legacyContent];

  if (!release && !LegacyContent) notFound();

  return (
    <main className="mx-auto w-11/12 max-w-[900px] pb-28 pt-32">
      <article className="rounded-xl bg-background p-8 md:p-12">
        <Link className="underline hover:text-secondary" href="/release-notes">
          {t("releaseNotes.back")}
        </Link>
        {LegacyContent ? (
          <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
            <LegacyContent />
          </div>
        ) : (
          <>
            <time
              className="mt-8 block text-sm text-muted-foreground"
              dateTime={slug}
            >
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(`${slug}T00:00:00Z`))}
            </time>
            <h1 className="mt-2 text-3xl font-bold">
              {t(`releaseNotes.entries.${slug}.title`)}
            </h1>
            <p className="mt-4">{t(`releaseNotes.entries.${slug}.summary`)}</p>
            {releaseProducts
              .filter((product) => release?.content.products[product])
              .map((product) => {
                const items = release!.content.products[product]!.items;
                return (
                  <section className="mt-10" key={product}>
                    <h2 className="text-2xl font-semibold">
                      {t(`releaseNotes.products.${product}`)}
                    </h2>
                    <ul className="mt-4 list-outside list-disc space-y-2 pl-6">
                      {items.map((_, index) => (
                        <li key={index}>
                          {t(
                            `releaseNotes.entries.${slug}.products.${product}.items.${index}`,
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </>
        )}
      </article>
    </main>
  );
}

export async function generateStaticParams() {
  return [
    ...legacyReleases.map(({ slug }) => ({ slug })),
    ...(await getDatedReleases()).map(({ date }) => ({ slug: date })),
  ];
}
