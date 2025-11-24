"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

import OwnerRecipe from "@/components/recipes/OwnerRecipe";
import PublicRecipe from "@/components/recipes/PublicRecipe";
import Loading from "@/components/loading";
import SavedRecipeProvider from "../providers/SavedRecipeProvider";
import { useRecipeQuery } from "@/hooks/useRecipeQuery";
import { useAuth } from "@/hooks/useAuth";

const RecipePage = () => {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfRedirect = JSON.parse(searchParams.get("pdf") || "false");
  const { toast } = useToast();

  const { data: recipe, error, isLoading } = useRecipeQuery(id, isLoggedIn);

  // Handle errors
  useEffect(() => {
    if (!error) return;

    const status = (error as any).status;
    console.log("Recipe load error:", error, status);

    if (status === 403) {
      toast({
        title: "Unauthorized",
        description: "You are not authorized to view this recipe.",
        variant: "destructive"
      });
      router.push("/account");
      return;
    }

    if (status === 404) {
      toast({
        title: "Recipe Not Found",
        description: "The requested recipe does not exist.",
        variant: "destructive"
      });
      router.push("/account");
      return;
    }

    toast({
      title: "Error",
      description: "An error occurred while loading this recipe.",
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
      ? null
      : (recipe.ratings.find((r) => r.user_id === userId)?.rating ?? null);
  const isOwner = userId === ownerId;

  const {
    nutrientData,
    getSelectedSchedule,
    emailNotifications,
    privateRecipe
  } = recipe;

  // Build the value to feed into SavedRecipeProvider
  const providerRecipe = {
    ...recipe,
    nutrientData: {
      ...nutrientData,
      selected: {
        ...nutrientData.selected,
        selectedNutrients: getSelectedSchedule(nutrientData.selected.schedule)
      }
    },
    userRating
    // everything else (recipeData, yanContribution, etc.) is already on `recipe`
  };

  return (
    <SavedRecipeProvider recipe={providerRecipe}>
      {isOwner ? (
        <OwnerRecipe
          pdfRedirect={pdfRedirect}
          privateRecipe={privateRecipe}
          recipeId={recipe.id}
          emailNotifications={emailNotifications}
        />
      ) : (
        <PublicRecipe />
      )}
    </SavedRecipeProvider>
  );
};

export default RecipePage;
