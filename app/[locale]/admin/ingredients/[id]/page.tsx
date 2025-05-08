"use client";
import { useParams } from "next/navigation";
import { useFetchData } from "@/hooks/useFetchData";
import Loading from "@/components/loading";
import Link from "next/link";
import IngredientEditForm from "@/components/admin/IngredientEditForm";
import { Ingredient } from "@/types/admin";

export default function IngredientEditPage() {
  const { id } = useParams();
  const {
    data: ingredient,
    loading,
    error,
  } = useFetchData<Ingredient>(`/api/ingredients/${id}`);

  if (loading) return <Loading />;
  if (error) return <p>Error: {error.message}</p>;
  if (!ingredient) return null;

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
