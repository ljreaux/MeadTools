import { redirect } from "next/navigation";

export default async function RecipeBuildingIndexPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect(`/${locale}/recipe-building/calculating-gravity`);
}
