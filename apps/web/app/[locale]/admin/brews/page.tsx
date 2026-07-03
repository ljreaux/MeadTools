"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccountPagination } from "@/components/account/pagination";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BrewList } from "@/components/brews/BrewList";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useAdminBrews } from "@/hooks/reactQuery/useAdminDashboard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { BREW_STAGE } from "@/lib/brewEnums";

export default function AdminBrewsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedQuery = useDebouncedValue(query, 350);
  const { data, isLoading, isFetching, isError } = useAdminBrews({
    page,
    limit,
    query: debouncedQuery || undefined,
    stage: stage === "all" ? undefined : stage,
    status: status === "all" ? undefined : status
  });

  useEffect(() => setPage(1), [debouncedQuery, limit, stage, status]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.brews", "Brews")}
        description={t(
          "admin.brews.description",
          "Inspect every brew in the tracker without changing owner data."
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_11rem_11rem_7rem]">
        <InputGroup>
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(
              "admin.brews.searchPlaceholder",
              "Search brews, recipes, or owners"
            )}
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                title={t("clear", "Clear")}
                onClick={() => setQuery("")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStages", "All stages")}</SelectItem>
            {Object.values(BREW_STAGE).map((value) => (
              <SelectItem key={value} value={value}>
                {t(`brewStage.${value}`, value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all", "All")}</SelectItem>
            <SelectItem value="active">{t("active", "Active")}</SelectItem>
            <SelectItem value="complete">
              {t("complete", "Complete")}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(limit)}
          onValueChange={(value) => setLimit(Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isError ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {t("error.generic", "Something went wrong.")}
        </div>
      ) : null}
      <BrewList
        brews={data?.brews ?? []}
        detailHref={(id) => `/admin/brews/${id}`}
        recipeHref={(id) => `/admin/recipes/${id}`}
        loading={isLoading || (!data && isFetching)}
        loadingRows={limit}
        showOwner
        showVisibility
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          {t("showingCount", "Showing {{shown}} of {{total}}", {
            shown: data?.brews.length ?? 0,
            total: data?.totalCount ?? 0
          })}
        </span>
        <AccountPagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          canPrev={page > 1}
          canNext={page < (data?.totalPages ?? 1)}
          onPrev={() => setPage((value) => value - 1)}
          onNext={() => setPage((value) => value + 1)}
          onGoTo={setPage}
        />
      </div>
    </div>
  );
}
