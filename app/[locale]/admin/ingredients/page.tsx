"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useFetchData } from "@/hooks/useFetchData";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Ingredient = {
  id: number;
  name: string;
  sugar_content: string | number;
  water_content: string | number;
  category: string | number;
};

function IngredientDashboard() {
  const router = useRouter();
  const {
    data: ingredients,
    loading,
    error,
  } = useFetchData<Ingredient[]>("/api/ingredients");

  if (loading) return <Loading />;
  if (error) return <div>An error has occured.</div>;

  if (!ingredients) return null;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Ingredients</h1>
        <Link href={"/admin/ingredients/new-ingredient"}>
          Add New Ingredient
        </Link>
      </div>

      <PaginatedTable
        data={ingredients}
        columns={[
          { key: "name", header: "Name" },
          { key: "sugar_content", header: "Brix" },
          { key: "water_content", header: "Water %" },
          { key: "category", header: "Category" },
        ]}
        pageSize={10}
        onRowClick={(ingredient) =>
          router.push(`/admin/ingredients/${ingredient.id}`)
        }
      />
    </div>
  );
}

export default IngredientDashboard;
