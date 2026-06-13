"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type BrewListDisplayItem = {
  id: string;
  name: string | null;
  start_date: string | Date;
  end_date: string | Date | null;
  stage: string;
  public?: boolean;
  recipe_id: number | null;
  recipe_name: string | null;
  entry_count: number;
  owner?: { displayName: string } | null;
};

export function BrewList({
  brews,
  detailHref,
  recipeHref = (recipeId) => `/recipes/${recipeId}`,
  loading = false,
  loadingRows = 10,
  showOwner = false,
  showVisibility = false,
  emptyMessage
}: {
  brews: BrewListDisplayItem[];
  detailHref: (brewId: string) => string;
  recipeHref?: (recipeId: number) => string;
  loading?: boolean;
  loadingRows?: number;
  showOwner?: boolean;
  showVisibility?: boolean;
  emptyMessage?: string;
}) {
  const { t, i18n } = useTranslation();
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });
  const formatDate = (date: string | Date) => formatter.format(new Date(date));
  const columnCount = 6 + (showOwner ? 1 : 0) + (showVisibility ? 1 : 0);

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border bg-card">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn(
                "sticky left-0 z-10 min-w-40 border-r bg-card",
                "sm:min-w-64"
              )}
            >
              {t("name")}
            </TableHead>
            {showOwner ? (
              <TableHead>{t("admin.owner", "Owner")}</TableHead>
            ) : null}
            {showVisibility ? (
              <TableHead>
                {t("brews.visibility.label", "Visibility")}
              </TableHead>
            ) : null}
            <TableHead>{t("brews.stage")}</TableHead>
            <TableHead>{t("brews.recipe")}</TableHead>
            <TableHead>{t("brews.startDate")}</TableHead>
            <TableHead>{t("brews.endDate")}</TableHead>
            <TableHead className="text-right">{t("brews.entries")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BrewListSkeleton
              rows={loadingRows}
              showOwner={showOwner}
              showVisibility={showVisibility}
            />
          ) : brews.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="h-28 text-center text-muted-foreground"
              >
                {emptyMessage ?? t("brews.none")}
              </TableCell>
            </TableRow>
          ) : (
            brews.map((brew) => (
              <TableRow key={brew.id}>
                <TableCell className="sticky left-0 z-10 max-w-64 border-r bg-card font-medium">
                  <Link
                    href={detailHref(brew.id)}
                    className="block truncate underline underline-offset-4"
                    title={brew.name || brew.id}
                  >
                    {brew.name || brew.id}
                  </Link>
                </TableCell>
                {showOwner ? (
                  <TableCell className="whitespace-nowrap">
                    {brew.owner?.displayName || "—"}
                  </TableCell>
                ) : null}
                {showVisibility ? (
                  <TableCell className="whitespace-nowrap">
                    {brew.public
                      ? t("brews.visibility.public", "Public")
                      : t("brews.visibility.private", "Private")}
                  </TableCell>
                ) : null}
                <TableCell className="whitespace-nowrap">
                  {t(`brewStage.${brew.stage}`, brew.stage)}
                </TableCell>
                <TableCell>
                  {brew.recipe_id ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={recipeHref(brew.recipe_id)}>
                        {brew.recipe_name || t("open")}
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(brew.start_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {brew.end_date ? formatDate(brew.end_date) : t("ongoing")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {brew.entry_count ?? 0}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function BrewListSkeleton({
  rows,
  showOwner,
  showVisibility
}: {
  rows: number;
  showOwner: boolean;
  showVisibility?: boolean;
}) {
  return Array.from({ length: rows }).map((_, index) => (
    <TableRow key={index}>
      <TableCell className="sticky left-0 z-10 border-r bg-card">
        <Skeleton className="h-4 w-40" />
      </TableCell>
      {showOwner ? (
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
      ) : null}
      {showVisibility ? (
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
      ) : null}
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-8" />
      </TableCell>
    </TableRow>
  ));
}
