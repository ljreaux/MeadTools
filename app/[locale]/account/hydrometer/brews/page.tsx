"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

import {
  useBrews,
  useUpdateEmailAlerts,
  Brew
} from "@/hooks/reactQuery/useBrews";

import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { AccountPagination } from "@/components/account/pagination";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

import Tooltip from "@/components/Tooltips";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

function Brews() {
  const { t, i18n } = useTranslation();
  const { data: brews = [], isLoading, isError } = useBrews();

  const [pageSize, setPageSize] = useState(5);

  const {
    filteredData,
    pageData,
    searchValue,
    search,
    clearSearch,
    page,
    nextPage,
    prevPage,
    goToPage,
    totalPages
  } = useFuzzySearch({
    data: brews,
    pageSize,
    searchKey: ["name", "id"]
  });

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });
  const formatDate = (date: string | Date) => formatter.format(new Date(date));

  if (isError) {
    return (
      <div className="text-center my-4">
        {t("error.generic", "Something went wrong loading brews.")}
      </div>
    );
  }

  // NOTE: during loading we still render the full layout, but with skeletons
  const showEmptyState =
    !isLoading && (!filteredData || filteredData.length === 0);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl">{t("iSpindelDashboard.brews.label")}</h2>

      {/* Search + per-page */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <InputGroup className="w-full sm:max-w-sm">
          <InputGroupInput
            value={searchValue}
            onChange={(e) => search(e.target.value)}
            placeholder={t("iSpindelDashboard.searchBrews", "Search brews")}
            disabled={isLoading}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              title={t("clear", "Clear")}
              onClick={clearSearch}
              className={cn({ hidden: searchValue.length === 0 })}
              disabled={isLoading}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">
            {t("pagination.perPage", "Per page:")}
          </span>

          {isLoading ? (
            <Skeleton className="h-9 w-[120px]" />
          ) : (
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(parseInt(val, 10))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Empty state (only after load) */}
      {showEmptyState ? (
        <div className="text-center my-4">
          {searchValue
            ? t("noResults", "No results found.")
            : t("iSpindelDashboard.noBrews")}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="w-full overflow-x-auto rounded-md border border-border bg-card">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className={cn(
                      "sticky left-0 z-10 bg-card border-r",
                      "min-w-24 sm:min-w-60"
                    )}
                  >
                    {t("iSpindelDashboard.nameOrId")}
                  </TableHead>

                  <TableHead>
                    {t("iSpindelDashboard.brews.startDate")}
                  </TableHead>
                  <TableHead>{t("iSpindelDashboard.brews.endDate")}</TableHead>
                  <TableHead>
                    {t("iSpindelDashboard.brews.latestGrav")}
                  </TableHead>

                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      {t("iSpindelDashboard.receiveEmailAlerts")}
                      <Tooltip body={t("tipText.emailAlerts")} />
                    </span>
                  </TableHead>

                  <TableHead>
                    {t("iSpindelDashboard.brews.recipeLink")}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <BrewsTableSkeleton rows={pageSize} />
                ) : (
                  pageData.map((brew) => (
                    <BrewRow
                      key={brew.id}
                      brew={brew}
                      formatDate={formatDate}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <AccountPagination
              page={page}
              totalPages={totalPages}
              canPrev={page > 1}
              canNext={page < totalPages}
              onPrev={prevPage}
              onNext={nextPage}
              onGoTo={goToPage}
            />
          )}

          {/* Optional: small skeleton hint where pagination will appear */}
          {isLoading && (
            <div className="flex justify-center pt-2">
              <Skeleton className="h-10 w-[260px]" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Brews;

function BrewRow({
  brew,
  formatDate
}: {
  brew: Brew;
  formatDate: (d: string | Date) => string;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: updateEmailAlerts } = useUpdateEmailAlerts();
  const [checked, setChecked] = useState(brew.requested_email_alerts);

  const gravity = normalizeNumberString(
    brew.latest_gravity ?? 0,
    3,
    i18n.resolvedLanguage,
    true
  );

  return (
    <TableRow>
      <TableCell
        className={cn(
          "sticky left-0 z-10 bg-card border-r font-medium text-muted-foreground truncate",
          "max-w-24 sm:max-w-60"
        )}
      >
        <Link
          href={`/account/hydrometer/logs/${brew.id}`}
          className="underline block truncate"
          title={brew.name || brew.id}
        >
          {brew.name || brew.id}
        </Link>
      </TableCell>

      <TableCell>{formatDate(brew.start_date)}</TableCell>

      <TableCell>
        {brew.end_date ? formatDate(brew.end_date) : t("ongoing", "Ongoing")}
      </TableCell>

      <TableCell>{gravity !== "0.000" ? gravity : "—"}</TableCell>

      <TableCell>
        <div className="w-full flex items-center">
          <Switch
            checked={checked}
            onCheckedChange={async (val) => {
              try {
                setChecked(val);
                await updateEmailAlerts({ brewId: brew.id, requested: val });

                const msg = val
                  ? t(
                      "emailAlerts.enabled",
                      "You will receive email alerts for this brew."
                    )
                  : t(
                      "emailAlerts.disabled",
                      "You will no longer receive email alerts for this brew."
                    );

                toast({ description: msg });
              } catch {
                setChecked(!val);
                toast({
                  description: t("error.generic", "Something went wrong"),
                  variant: "destructive"
                });
              }
            }}
          />
        </div>
      </TableCell>

      <TableCell>
        {brew.recipe_id ? (
          <Link
            href={`/recipes/${brew.recipe_id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t("iSpindelDashboard.brews.open")}
          </Link>
        ) : (
          <Link
            href={`/account/hydrometer/link/${brew.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t("iSpindelDashboard.brews.link")}
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}

function BrewsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {/* sticky first column (MATCH header sizing) */}
          <TableCell
            className={cn(
              "sticky left-0 z-10 bg-card border-r",
              "min-w-24 sm:min-w-60",
              "max-w-24 sm:max-w-60",
              "truncate" // match real cell behavior
            )}
          >
            <Skeleton className="h-4 w-full max-w-[10rem] sm:max-w-[14rem]" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-4 w-full max-w-[8rem]" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-4 w-full max-w-[8rem]" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-4 w-full max-w-[5rem]" />
          </TableCell>

          <TableCell>
            <div className="w-full flex items-center">
              <Skeleton className="w-9 h-5 rounded-full" />
            </div>
          </TableCell>

          <TableCell>
            {/* button-ish */}
            <Skeleton className="h-8 w-[96px] rounded-md" />{" "}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
