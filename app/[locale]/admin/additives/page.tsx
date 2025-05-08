"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useFetchData } from "@/hooks/useFetchData";
import { Additive } from "@/types/admin";
import Link from "next/link";
import { useRouter } from "next/navigation";

function AdditiveDashboard() {
  const router = useRouter();
  const {
    data: additives,
    loading,
    error,
  } = useFetchData<Additive[]>("/api/additives");

  if (loading) return <Loading />;
  if (error) return <div>An error has occured.</div>;

  if (!additives) return null;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Additives</h1>
        <Link href={"/admin/additives/new-additive"}>Add New additive</Link>
      </div>

      <PaginatedTable
        data={additives}
        columns={[
          { key: "name", header: "Name" },
          { key: "dosage", header: "Dosage" },
          { key: "unit", header: "Unit" },
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
