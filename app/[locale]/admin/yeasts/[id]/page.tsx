"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Loading from "@/components/loading";
import YeastEditForm from "@/components/admin/YeastEditForm";
import { Yeast } from "@/types/nutrientTypes";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";

export default function YeastEditPage() {
  const params = useParams();
  const idParam = params.id as string;
  const id = Number(idParam);

  const { data: yeasts, isLoading, isError, error } = useYeastsQuery();

  if (isLoading) return <Loading />;

  if (isError) {
    const msg = (error as Error)?.message || "An error has occurred.";
    return <p>Error: {msg}</p>;
  }

  if (!yeasts) return null;

  const yeast: Yeast | undefined = yeasts.find((y) => y.id === id);

  if (!yeast) {
    return <p>Yeast not found.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-6">Edit Yeast</h2>
        <Link href={"/admin/yeasts"}>Back to All Yeasts</Link>
      </div>
      <YeastEditForm yeast={yeast} />
    </div>
  );
}
