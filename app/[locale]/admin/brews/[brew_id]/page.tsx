"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { BrewViewer } from "@/components/brews/BrewViewer";
import Loading from "@/components/loading";
import { useAdminBrew } from "@/hooks/reactQuery/useAdminDashboard";

export default function AdminBrewPage() {
  const { brew_id: brewId } = useParams<{ brew_id: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAdminBrew(brewId);

  if (isLoading) return <Loading />;
  if (isError || !data)
    return (
      <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
        {t("brews.notFound", "Brew not found.")}
      </div>
    );

  return (
    <BrewViewer
      brew={data}
      backHref="/admin/brews"
      recipeHref={data.recipe_id ? `/admin/recipes/${data.recipe_id}` : null}
    />
  );
}
