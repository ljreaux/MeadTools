"use client";

import { useTranslation } from "react-i18next";

import { EstimatedAbvRebuild } from "@/components/admin/EstimatedAbvRebuild";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function AdminMaintenancePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.maintenance.title", "Maintenance")}
        description={t(
          "admin.maintenance.description",
          "Run safe administrative maintenance tasks in small batches."
        )}
      />
      <EstimatedAbvRebuild />
    </div>
  );
}
