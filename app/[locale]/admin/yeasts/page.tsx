"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useFetchData } from "@/hooks/useFetchData";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Yeast = {
  id: number;
  brand: string;
  name: string;
  nitrogen_requirement: string;
  tolerance: string | number;
  low_temp: string | number;
  high_temp: string | number;
};

function YeastDashboard() {
  const router = useRouter();
  const { data: yeasts, loading, error } = useFetchData<Yeast[]>("/api/yeasts");

  if (loading) return <Loading />;
  if (error) return <div>An error has occured.</div>;

  if (!yeasts) return null;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Yeasts</h1>
        <Link href={"/admin/yeasts/new-yeast"}>Add New Yeast</Link>
      </div>

      <PaginatedTable
        data={yeasts}
        columns={[
          { key: "brand", header: "Brand" },
          { key: "name", header: "Name" },
          { key: "nitrogen_requirement", header: "Nitrogen" },
          { key: "tolerance", header: "Alcohol Tolerance" },
          { key: "low_temp", header: "Low Temp" },
          { key: "high_temp", header: "High Temp" },
        ]}
        pageSize={10}
        onRowClick={(yeast) => router.push(`/admin/yeasts/${yeast.id}`)}
      />
    </div>
  );
}

export default YeastDashboard;
