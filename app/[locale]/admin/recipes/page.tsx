"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccountPagination } from "@/components/account/pagination";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useAdminRecipesQuery } from "@/hooks/reactQuery/useAdminRecipesQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 10;

export default function RecipesDashboard() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const { data, isLoading, isError } = useAdminRecipesQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined
  });

  useEffect(() => setPage(1), [debouncedSearch]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.recipes", "Recipes")}
        description={t(
          "admin.recipes.description",
          "Open public and private recipes in a read-only administrative view."
        )}
      />
      <InputGroup className="max-w-xl">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t(
            "admin.recipes.searchPlaceholder",
            "Search name or owner"
          )}
        />
        {search ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              title={t("clear", "Clear")}
              onClick={() => setSearch("")}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      {isError ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {t("error.generic", "Something went wrong.")}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name", "Name")}</TableHead>
              <TableHead>{t("admin.owner", "Owner")}</TableHead>
              <TableHead>{t("private", "Private")}</TableHead>
              <TableHead className="text-right">
                {t("actions", "Actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell
                    colSpan={4}
                    className="h-12 animate-pulse bg-muted/20"
                  />
                </TableRow>
              ))
            ) : data?.recipes.length ? (
              data.recipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell className="font-medium">{recipe.name}</TableCell>
                  <TableCell>{recipe.public_username || "-"}</TableCell>
                  <TableCell>
                    {recipe.private ? t("yes", "Yes") : t("no", "No")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/admin/recipes/${recipe.id}`}>
                        {t("view", "View")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-28 text-center text-muted-foreground"
                >
                  {t("recipes.none", "No recipes found.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          {t("showingCount", "Showing {{shown}} of {{total}}", {
            shown: data?.recipes.length ?? 0,
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
