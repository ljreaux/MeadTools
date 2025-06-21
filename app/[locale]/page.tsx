import ProviderWrapper from "@/components/recipeBuilder/ProviderWrapper";
import RecipeBuilder from "@/components/recipeBuilder/RecipeBuilder";

export default async function Home() {
  return (
    <ProviderWrapper>
      <RecipeBuilder />
    </ProviderWrapper>
  );
}
