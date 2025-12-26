"use client";

import { useParams } from "next/navigation";
import Loading from "@/components/loading";
import Link from "next/link";
import AdditiveEditForm from "@/components/admin/AdditiveEditForm";
import type { Additive } from "@/types/recipeDataTypes";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";

export default function AdditiveEditPage() {
  const params = useParams();
  const { id } = params;

  const { data: additives, isLoading, isError, error } = useAdditivesQuery();

  if (isLoading) return <Loading />;

  if (isError) {
    const msg = (error as Error)?.message || "An error has occurred.";
    return <p>Error: {msg}</p>;
  }

  if (!additives) return null;

  const additive: Additive | undefined = additives.find((a) => a.id === id);

  if (!additive) {
    return <p>Additive not found.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-6">Edit Additive</h2>
        <Link href={"/admin/additives"}>Back to All Additives</Link>
      </div>
      <AdditiveEditForm additive={additive} />
    </div>
  );
}
