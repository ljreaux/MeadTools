"use client";

import { useParams } from "next/navigation";
import Loading from "@/components/loading";
import Link from "next/link";
import IngredientEditForm from "@/components/admin/IngredientEditForm";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import type { Ingredient } from "@/types/recipeDataTypes";

export default function IngredientEditPage() {
  const params = useParams();
  const id = params.id;

  const {
    data: ingredients,
    isLoading,
    isError,
    error
  } = useIngredientsQuery(); // shared cache with the list page

  if (isLoading) return <Loading />;

  if (isError) {
    const message =
      (error as Error)?.message || "An error has occurred while loading.";
    return <p>Error: {message}</p>;
  }

  if (!ingredients) return null;

  const ingredient: Ingredient | undefined = ingredients.find(
    (ing) => ing.id === id
  );

  if (!ingredient) {
    return <p>Ingredient not found.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-6">Edit Ingredient</h2>
        <Link href={"/admin/ingredients"}>Back to All Ingredients</Link>
      </div>
      <IngredientEditForm ingredient={ingredient} />
    </div>
  );
}
