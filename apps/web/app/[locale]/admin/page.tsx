"use client";
import Link from "next/link";
import {
  Beer,
  FlaskConical,
  NotebookText,
  TestTube2,
  Users,
  Wheat
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSummary } from "@/hooks/reactQuery/useAdminDashboard";

function AdminDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAdminSummary();
  const items = [
    {
      label: t("admin.nav.users", "Users"),
      value: data?.users,
      href: "/admin/users",
      icon: Users
    },
    {
      label: t("admin.nav.brews", "Brews"),
      value: data?.brews,
      detail: data
        ? t("admin.overview.activeBrews", "{{count}} active", {
            count: data.activeBrews
          })
        : undefined,
      href: "/admin/brews",
      icon: Beer
    },
    {
      label: t("admin.nav.recipes", "Recipes"),
      value: data?.recipes,
      detail: data
        ? t("admin.overview.privateRecipes", "{{count}} private", {
            count: data.privateRecipes
          })
        : undefined,
      href: "/admin/recipes",
      icon: NotebookText
    },
    {
      label: t("admin.nav.yeasts", "Yeasts"),
      value: data?.yeasts,
      href: "/admin/yeasts",
      icon: FlaskConical
    },
    {
      label: t("admin.nav.ingredients", "Ingredients"),
      value: data?.ingredients,
      href: "/admin/ingredients",
      icon: Wheat
    },
    {
      label: t("admin.nav.additives", "Additives"),
      value: data?.additives,
      href: "/admin/additives",
      icon: TestTube2
    }
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.overview.title", "Overview")}
        description={t(
          "admin.overview.description",
          "Review site activity and open an administrative workspace."
        )}
      />
      {isError ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {t("error.generic", "Something went wrong.")}
        </div>
      ) : null}
      <div className="grid border-l border-t sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ label, value, detail, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group min-h-36 border-b border-r p-5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{label}</span>
              <Icon className="size-4" />
            </div>
            {isLoading ? (
              <Skeleton className="mt-5 h-9 w-20" />
            ) : (
              <div className="mt-5 text-3xl font-semibold tabular-nums">
                {value ?? 0}
              </div>
            )}
            {detail ? (
              <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
