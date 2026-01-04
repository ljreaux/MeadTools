"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Search } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";

import { AccountPagination } from "@/components/account/pagination";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";

import {
  useAccountBrews,
  type AccountBrewListItem
} from "@/hooks/reactQuery/useAccountBrews";

export default function AccountBrews() {
  const { t, i18n } = useTranslation();
  const { data: brews = [], isLoading, isError, error } = useAccountBrews();

  const [pageSize, setPageSize] = useState(10);

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
    searchKey: ["name", "id", "recipe_name", "stage"]
  });

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });
  const formatDate = (date: string | Date) => formatter.format(new Date(date));

  if (isError) {
    console.error(error);
    return (
      <div className="text-center my-4">
        {t("error.generic", "Something went wrong loading brews.")}
      </div>
    );
  }

  const showEmptyState =
    !isLoading && (!filteredData || filteredData.length === 0);

  return (
    <div className="w-11/12 max-w-[1200px] relative rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
      <div className="space-y-4">
        <h2 className="text-2xl">{t("brews.label")}</h2>
        <Button asChild>
          <Link href="/account/brews/new">{t("brews.new", "New Brew")}</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <InputGroup className="w-full sm:max-w-sm">
            <InputGroupInput
              value={searchValue}
              onChange={(e) => search(e.target.value)}
              placeholder={t("search")}
              disabled={isLoading}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                title={t("clear")}
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

        {showEmptyState ? (
          <div className="text-center my-4">
            {searchValue ? t("noResults") : t("brews.none")}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto rounded-md border border-border bg-card">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className={cn(
                        "sticky left-0 z-10 bg-card border-r",
                        "min-w-28 sm:min-w-72"
                      )}
                    >
                      {t("name")}
                    </TableHead>

                    <TableHead>{t("brews.stage")}</TableHead>
                    <TableHead>{t("brews.recipe")}</TableHead>
                    <TableHead>{t("brews.startDate")}</TableHead>
                    <TableHead>{t("brews.endDate")}</TableHead>
                    <TableHead>{t("brews.entries")}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <AccountBrewsTableSkeleton rows={pageSize} />
                  ) : (
                    pageData.map((brew) => (
                      <AccountBrewRow
                        key={brew.id}
                        brew={brew}
                        formatDate={formatDate}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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

            {isLoading && (
              <div className="flex justify-center pt-2">
                <Skeleton className="h-10 w-[260px]" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AccountBrewRow({
  brew,
  formatDate
}: {
  brew: AccountBrewListItem;
  formatDate: (d: string | Date) => string;
}) {
  const { t } = useTranslation();

  return (
    <TableRow>
      <TableCell
        className={cn(
          "sticky left-0 z-10 bg-card border-r font-medium truncate",
          "max-w-28 sm:max-w-72"
        )}
      >
        <Link
          href={`/account/brews/${brew.id}`}
          className="underline block truncate"
          title={brew.name || brew.id}
        >
          {brew.name || brew.id}
        </Link>
      </TableCell>

      <TableCell className="whitespace-nowrap">
        {t(`brewStage.${brew.stage}`)}
      </TableCell>

      <TableCell>
        {brew.recipe_id ? (
          <Link
            href={`/recipes/${brew.recipe_id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {brew.recipe_name || t("open")}
          </Link>
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

      <TableCell className="whitespace-nowrap">
        {brew.entry_count ?? 0}
      </TableCell>
    </TableRow>
  );
}

function AccountBrewsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell
            className={cn(
              "sticky left-0 z-10 bg-card border-r",
              "min-w-28 sm:min-w-72",
              "max-w-28 sm:max-w-72",
              "truncate"
            )}
          >
            <Skeleton className="h-4 w-full max-w-[14rem]" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-4 w-[90px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-[120px] rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-[110px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-[110px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-[40px]" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
