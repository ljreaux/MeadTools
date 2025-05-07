"use client";
import { useParams } from "next/navigation";
import { useFetchData } from "@/hooks/useFetchData";
import YeastEditForm from "@/components/admin/YeastEditForm";
import { Yeast } from "../page";
import Loading from "@/components/loading";
import Link from "next/link";

export default function YeastEditPage() {
  const { id } = useParams();
  const {
    data: yeast,
    loading,
    error,
  } = useFetchData<Yeast>(`/api/yeasts/${id}`);

  if (loading) return <Loading />;
  if (error) return <p>Error: {error.message}</p>;
  if (!yeast) return null;

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
