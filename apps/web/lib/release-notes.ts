import { loadTranslationResource } from "@meadtools/i18n/resources";

export const legacyReleases = [
  { slug: "v4-0", title: "MeadTools v4.0" },
  { slug: "v3-5", title: "MeadTools v3.5" },
] as const;

export const releaseProducts = [
  "web",
  "mobile",
  "mobilePreview",
  "chat",
  "api",
] as const;

type ReleaseProduct = (typeof releaseProducts)[number];

type ReleaseContent = {
  title: string;
  summary: string;
  products: Partial<Record<ReleaseProduct, { items: string[] }>>;
};

export async function getDatedReleases(): Promise<
  Array<{ date: string; content: ReleaseContent }>
> {
  const resource = await loadTranslationResource("en", "default");
  const entries =
    (
      resource.releaseNotes as
        { entries?: Record<string, ReleaseContent> } | undefined
    )?.entries ?? {};

  return Object.entries(entries)
    .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, content]) => ({ date, content }));
}
