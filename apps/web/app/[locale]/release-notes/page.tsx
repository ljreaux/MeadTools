import initTranslations from "@/lib/i18n";
import { getDatedReleases, legacyReleases } from "@/lib/release-notes";
import Link from "next/link";

export default async function ReleaseNotesIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ["default"]);
  const releases = await getDatedReleases();

  return (
    <main className="mx-auto w-11/12 max-w-[900px] pb-28 pt-32">
      <div className="rounded-xl bg-background p-8 md:p-12">
        <h1 className="text-3xl font-bold">{t("releaseNotes.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("releaseNotes.intro")}</p>
        {releases.length > 0 && (
          <ol className="mt-8 space-y-6">
            {releases.map(({ date }) => (
              <li key={date} className="border-b pb-5 last:border-0">
                <p className="text-sm text-muted-foreground">
                  <time dateTime={date}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }).format(new Date(`${date}T00:00:00Z`))}
                  </time>
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  <Link
                    className="underline hover:text-secondary"
                    href={`/release-notes/${date}`}
                  >
                    {t(`releaseNotes.entries.${date}.title`)}
                  </Link>
                </h2>
                <p className="mt-2">
                  {t(`releaseNotes.entries.${date}.summary`)}
                </p>
              </li>
            ))}
          </ol>
        )}
        <h2 className="mt-10 text-xl font-semibold">
          {t("releaseNotes.archive")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("releaseNotes.archiveLanguage")}
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2">
          {legacyReleases.map(({ slug, title }) => (
            <li key={slug}>
              <Link
                className="underline hover:text-secondary"
                href={`/release-notes/${slug}`}
              >
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
