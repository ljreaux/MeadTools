"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useAdminFetchData } from "@/hooks/useAdminFetchData";
import { Recipe } from "@/types/admin";

function RecipesDashboard() {
  const {
    data: recipes,
    loading,
    error,
  } = useAdminFetchData<{ recipes: Recipe[] }>("/api/recipes");

  if (loading) return <Loading />;
  if (error) return <div>An error has occured.</div>;

  if (!recipes) return null;

  return (
    <div>
      <h1 className="text-2xl">Recipes</h1>

      <PaginatedTable
        data={recipes.recipes.sort((a, b) => a.name.localeCompare(b.name))}
        columns={[
          { key: "name", header: "Name" },
          { key: "public_username", header: "Username" },
          { key: "private", header: "Private Recipe" },
        ]}
        pageSize={10}
        searchKey={["name", "public_username"]}
      />
    </div>
  );
}

export default RecipesDashboard;
