"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

import { useAccountBrews } from "@/hooks/reactQuery/useAccountBrews";
import { BrewList } from "@/components/brews/BrewList";

export default function AccountBrews() {
  const { t } = useTranslation();
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

  if (isError) {
    console.error(error);
    return (
      <div className="text-center my-4">
        {t("brews.error.loadList", "Something went wrong loading brews.")}
      </div>
    );
  }

  const showEmptyState =
    !isLoading && (!filteredData || filteredData.length === 0);

  return (
    <div className="space-y-4 sm:mt-6 mt-12">
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
          <BrewList
            brews={pageData}
            detailHref={(brewId) => `/account/brews/${brewId}`}
            loading={isLoading}
            loadingRows={pageSize}
          />

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
        </>
      )}
    </div>
  );
}
