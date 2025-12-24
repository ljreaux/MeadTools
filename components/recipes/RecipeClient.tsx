"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

import OwnerRecipe from "@/components/recipes/OwnerRecipe";
import PublicRecipe from "@/components/recipes/PublicRecipe";
import Loading from "@/components/loading";
// import SavedRecipeProvider from "../providers/SavedRecipeProvider";
import { useRecipeQuery } from "@/hooks/reactQuery/useRecipeQuery";
import { useAuth } from "@/hooks/auth/useAuth";
import { RecipeProvider } from "../providers/RecipeProvider";
import { useTranslation } from "react-i18next";

const RecipePage = () => {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfRedirect = JSON.parse(searchParams.get("pdf") || "false");
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: recipe, error, isLoading } = useRecipeQuery(id, isLoggedIn);

  // Handle errors
  useEffect(() => {
    if (!error) return;

    const status = (error as any).status;
    console.log("Recipe load error:", error, status);

    if (status === 403) {
      toast({
        title: t("unathorized"),
        description: t("cannotView"),
        variant: "destructive"
      });
      router.push("/account");
      return;
    }

    if (status === 404) {
      toast({
        title: t("recipeNotFoundTitle"),
        description: t("recipeNotFound"),
        variant: "destructive"
      });
      router.push("/account");
      return;
    }

    toast({
      title: t("errorLabel"),
      description: t("error.generic"),
      variant: "destructive"
    });
    router.push("/account");
  }, [error, router, toast]);

  // Loading state
  if (isLoading || (!recipe && !error)) {
    return <Loading />;
  }

  // If there *is* an error, the effect above will redirect; just render nothing
  if (error || !recipe) {
    return null;
  }

  const ownerId = recipe.user_id;
  const userId = user?.id ? Number(user.id) : null;

  const userRating =
    userId == null
      ? undefined
      : recipe.ratings.find((r) => r.user_id === userId)?.rating;

  const isOwner = userId === ownerId;

  return (
    <RecipeProvider>
      {isOwner ? (
        <OwnerRecipe pdfRedirect={pdfRedirect} recipe={recipe} />
      ) : (
        <PublicRecipe recipe={recipe} userRating={userRating} />
      )}
    </RecipeProvider>
  );
};

export default RecipePage;
