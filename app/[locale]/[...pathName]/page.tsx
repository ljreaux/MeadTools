import { notFound } from "next/navigation";
import "@/app/atom-one-dark.css";
import {
  RecipeBuildingNav,
  RecipeBuildingPager
} from "@/components/docs/RecipeBuildingNav";

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
    const isRecipeBuilding = pathToFile.startsWith("recipe-building/");
    const currentPath = `/${pathToFile}`;

    if (isRecipeBuilding) {
      return (
        <section className="w-full flex justify-center sm:pt-24 py-[6rem]">
          <div className="w-11/12 max-w-[1380px]">
            <div className="lg:hidden">
              <RecipeBuildingNav currentPath={currentPath} />
              <article className="rounded-2xl bg-background px-5 py-6 shadow-sm sm:px-8 sm:py-8">
                <div className="prose dark:prose-invert prose-a:text-blue-500 max-w-none">
                  <Post />
                  <RecipeBuildingPager currentPath={currentPath} />
                </div>
              </article>
            </div>

            <div className="hidden lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
              <aside className="sticky top-24 self-start">
                <RecipeBuildingNav currentPath={currentPath} />
              </aside>
              <article className="rounded-2xl bg-background px-10 py-8 shadow-sm xl:px-12">
                <div className="prose dark:prose-invert prose-a:text-blue-500 max-w-none">
                  <Post />
                  <RecipeBuildingPager currentPath={currentPath} />
                </div>
              </article>
            </div>
          </div>
        </section>
      );
    }

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
