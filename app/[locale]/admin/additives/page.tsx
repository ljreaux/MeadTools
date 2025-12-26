"use client";

import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";

function AdditiveDashboard() {
  const router = useRouter();

  const { data: additives, isLoading, isError } = useAdditivesQuery();

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occurred.</div>;
  if (!additives) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Additives</h1>
        <Link href={"/admin/additives/new-additive"}>Add New Additive</Link>
      </div>

      <PaginatedTable
        data={additives}
        columns={[
          { key: "name", header: "Name" },
          { key: "dosage", header: "Dosage" },
          { key: "unit", header: "Unit" }
        ]}
        pageSize={10}
        onRowClick={(additive) =>
          router.push(`/admin/additives/${additive.id}`)
        }
        searchKey={["name"]}
      />
    </div>
  );
}

export default AdditiveDashboard;
