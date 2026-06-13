"use client";

import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";

function AdditiveDashboard() {
  const router = useRouter();
  const { t } = useTranslation();

  const { data: additives, isLoading, isError } = useAdditivesQuery();

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occurred.</div>;
  if (!additives) return null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.additives", "Additives")}
        actions={
          <Button asChild>
            <Link href="/admin/additives/new-additive">
              <Plus />
              {t("admin.additives.add", "Add additive")}
            </Link>
          </Button>
        }
      />

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
        getRowKey={(additive) => additive.id}
      />
    </div>
  );
}

export default AdditiveDashboard;
