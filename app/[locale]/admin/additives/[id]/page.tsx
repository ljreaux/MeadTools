"use client";
import { useParams } from "next/navigation";
import { useFetchData } from "@/hooks/useFetchData";
import Loading from "@/components/loading";
import Link from "next/link";
import { Additive } from "@/types/admin";
import AdditiveEditForm from "@/components/admin/AdditiveEditForm";

export default function IngredientEditPage() {
  const { id } = useParams();
  const {
    data: additive,
    loading,
    error,
  } = useFetchData<Additive>(`/api/additives/${id}`);

  if (loading) return <Loading />;
  if (error) return <p>Error: {error.message}</p>;
  if (!additive) return null;

  console.log(additive);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-6">Edit Additives</h2>
        <Link href={"/admin/additives"}>Back to All Additives</Link>
      </div>
      <AdditiveEditForm additive={additive} />
    </div>
  );
}
