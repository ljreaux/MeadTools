import { notFound } from "next/navigation";
import "@/app/atom-one-dark.css";

async function loadPostModule(pathToFile: string, locale: string) {
  const localizedPath =
    locale !== "en" ? `${pathToFile}-${locale}` : pathToFile;

  // First try localized .mdx / .md
  try {
    return await import(`@/content/${localizedPath}.mdx`);
  } catch {}
  try {
    return await import(`@/content/${localizedPath}.md`);
  } catch {}

  // Fallback to default locale file (English)
  try {
    return await import(`@/content/${pathToFile}.mdx`);
  } catch {}
  try {
    return await import(`@/content/${pathToFile}.md`);
  } catch {}

  // Nothing found
  throw new Error(`Content not found for: ${pathToFile}`);
}

export default async function Page({
  params
}: {
  params: Promise<{ pathName: string[]; locale: string }>;
}) {
  const { pathName, locale } = await params;
  const pathToFile = pathName.join("/");

  try {
    const mod = await loadPostModule(pathToFile, locale);
    const Post = mod.default;

    return (
      <section className="w-full flex justify-center items-center sm:pt-24 pt-[6rem]">
        <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px] prose dark:prose-invert prose-a:text-blue-500">
          <Post />
        </div>
      </section>
    );
  } catch (err) {
    console.error(err);
    return notFound();
  }
}
