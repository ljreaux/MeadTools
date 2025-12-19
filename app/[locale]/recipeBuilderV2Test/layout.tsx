import { RecipeV2Provider } from "@/components/providers/RecipeProviderV2";

export default async function Layout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RecipeV2Provider>{children}</RecipeV2Provider>;
}
