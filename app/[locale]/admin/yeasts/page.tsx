"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";

function YeastDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: yeasts, isLoading, isError } = useYeastsQuery();

  if (isLoading) return <Loading />;
  if (isError) return <div>An error has occurred.</div>;
  if (!yeasts) return null;

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t("admin.nav.yeasts", "Yeasts")} actions={<Button asChild><Link href="/admin/yeasts/new-yeast"><Plus />{t("admin.yeasts.add", "Add yeast")}</Link></Button>} />

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
        getRowKey={(yeast) => yeast.id}
      />
    </div>
  );
}

export default YeastDashboard;
