"use client";

import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";

function IngredientDashboard() {
  const router = useRouter();
  const { t } = useTranslation();

  // React Query-based fetch
  const { data: ingredients, isLoading, isError } = useIngredientsQuery(); // no category needed here

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occured.</div>;
  if (!ingredients) return null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.ingredients", "Ingredients")}
        actions={
          <Button asChild>
            <Link href="/admin/ingredients/new-ingredient">
              <Plus />
              {t("admin.ingredients.add", "Add ingredient")}
            </Link>
          </Button>
        }
      />

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
        getRowKey={(ingredient) => ingredient.id}
      />
    </div>
  );
}

export default IngredientDashboard;
