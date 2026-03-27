import { notFound } from "next/navigation";
import "@/app/atom-one-dark.css";

async function tryImport(path: string) {
  try {
    return await import(`@/content/${path}.mdx`);
  } catch {}
  try {
    return await import(`@/content/${path}.md`);
  } catch {}
  return null;
}

async function loadPostModule(pathToFile: string, locale: string) {
  const localizedPath =
    locale !== "en" ? `${pathToFile}-${locale}` : pathToFile;

  const attempts = [
    localizedPath,
    `${localizedPath}/index`,
    pathToFile,
    `${pathToFile}/index`
  ];

  for (const attempt of attempts) {
    const mod = await tryImport(attempt);
    if (mod) return mod;
  }

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
      <section className="w-full flex justify-center items-center sm:pt-24 py-[6rem]">
        <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background w-11/12 max-w-[1200px] prose dark:prose-invert prose-a:text-blue-500 gap-0">
          <Post />
        </div>
      </section>
    );
  } catch (err) {
    console.error(err);
    return notFound();
  }
}
