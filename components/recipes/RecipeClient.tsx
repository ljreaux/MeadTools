"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

import { useToast } from "@/hooks/use-toast";
import OwnerRecipe from "@/components/recipes/OwnerRecipe";
import PublicRecipe from "@/components/recipes/PublicRecipe";
import Loading from "@/components/loading";
import SavedRecipeProvider from "../providers/SavedRecipeProvider";
import { parseRecipeData } from "@/lib/utils/parseRecipeData";

const RecipePage = ({ id }: { id: string }) => {
  const { fetchAuthenticatedData, user, isLoggedIn } = useAuth();
  const [recipe, setRecipe] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [redirected, setRedirected] = useState(false); // Track if redirected
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfRedirect: boolean = JSON.parse(searchParams.get("pdf") || "false");

  // Extract normalized user ID
  const getUserId = (): string | null => {
    if (!user) return null;
    return user.id || null;
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      if (redirected) return; // Prevent further execution if already redirected
      setIsLoading(true);

      try {
        let response;

        if (isLoggedIn) {
          // Authenticated request
          response = await fetchAuthenticatedData(`/api/recipes/${id}`);
          const userId = getUserId();
          if (userId) setIsOwner(response.recipe.user_id === parseInt(userId));
        } else {
          // Unauthenticated public request
          const res = await fetch(`/api/recipes/${id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          response = await res.json();
        }
        setRecipe(response.recipe);
      } catch (error: any) {
        handleFetchError(error);
      } finally {
        setIsLoading(false);
      }
    };

    const handleFetchError = (error: any) => {
      console.error("Error fetching recipe:", error);

      const status = error.message.includes("HTTP")
        ? parseInt(error.message.split(" ")[1], 10)
        : null;

      if (status === 403) {
        toast({
          title: "Unauthorized",
          description: "You are not authorized to view this recipe.",
          variant: "destructive",
        });
        setRedirected(true); // Prevent further redirects
        router.push("/account");
      } else if (status === 404) {
        toast({
          title: "Recipe Not Found",
          description: "The requested recipe does not exist.",
          variant: "destructive",
        });
        setRedirected(true); // Prevent further redirects
        router.push("/account");
      } else {
        toast({
          title: "Error",
          description: "An error occurred while fetching the recipe.",
          variant: "destructive",
        });
        setRedirected(true); // Prevent further redirects
        router.push("/account");
      }
    };

    fetchRecipe();
  }, [id, isLoggedIn, fetchAuthenticatedData, router, toast, user, redirected]);

  if (isLoading) {
    return <Loading />;
  }

  if (!recipe) {
    return null; // No recipe to render, fallback handled above
  }

  const {
    recipeData,
    nutrientData,
    getSelectedSchedule,
    yanContribution,
    yanFromSource,
    nuteInfo,
  } = parseRecipeData(recipe);

  return (
    <SavedRecipeProvider
      recipe={{
        ...recipe,
        recipeData,
        nutrientData: {
          ...nutrientData,
          selected: {
            ...nutrientData.selected,
            selectedNutrients: getSelectedSchedule(
              nutrientData.selected.schedule
            ),
          },
        },
        yanContribution,
        yanFromSource,
        nuteInfo,
      }}
    >
      <>
        {isOwner ? <OwnerRecipe pdfRedirect={pdfRedirect} /> : <PublicRecipe />}
      </>
    </SavedRecipeProvider>
  );
};

export default RecipePage;
