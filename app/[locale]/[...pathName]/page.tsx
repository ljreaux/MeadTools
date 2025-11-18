import { notFound } from "next/navigation";
import "@/app/atom-one-dark.css";

async function loadPostModule(pathToFile: string) {
  // Try .mdx first
  try {
    return await import(`@/content/${pathToFile}.mdx`);
  } catch {
    // Fallback to .md
    return await import(`@/content/${pathToFile}.md`);
  }
}

export default async function Page({
  params
}: {
  params: Promise<{ pathName: string[] }>;
}) {
  const { pathName } = await params;
  const pathToFile = pathName.join("/");

  try {
    const mod = await loadPostModule(pathToFile);
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
