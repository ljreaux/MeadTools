"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import Link from "next/link";
import { useRouter } from "next/navigation";

function YeastDashboard() {
  const router = useRouter();
  const { data: yeasts, isLoading, isError } = useYeastsQuery();

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occurred.</div>;
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
          { key: "high_temp", header: "High Temp" }
        ]}
        pageSize={10}
        onRowClick={(yeast) => router.push(`/admin/yeasts/${yeast.id}`)}
        searchKey={["name", "brand", "nitrogen_requirement"]}
      />
    </div>
  );
}

export default YeastDashboard;
