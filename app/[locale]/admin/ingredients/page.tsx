"use client";

import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";

function IngredientDashboard() {
  const router = useRouter();

  // React Query-based fetch
  const { data: ingredients, isLoading, isError } = useIngredientsQuery(); // no category needed here

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occured.</div>;
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
          { key: "category", header: "Category" }
        ]}
        pageSize={10}
        onRowClick={(ingredient) =>
          router.push(`/admin/ingredients/${ingredient.id}`)
        }
        searchKey={["name", "category"]}
      />
    </div>
  );
}

export default IngredientDashboard;
