"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

import { PagedResults } from "@/components/ui/paged-results";
import { AccountPagination } from "@/components/account/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useBrewById, useLinkBrewToRecipe } from "@/hooks/reactQuery/useBrews";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";

type RecipeRow = {
  id: number;
  name: string;
};

function LinkBrew() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const brewId = params.brewId as string;

  const {
    brew,
    isLoading: brewLoading,
    isError: brewError
  } = useBrewById(brewId);

  const {
    data: accountInfo,
    isLoading: accountLoading,
    isError: accountError
  } = useAccountInfo();

  const linkMutation = useLinkBrewToRecipe();

  const isLoading = brewLoading || accountLoading;
  const isError = brewError || accountError;

  // keep hooks unconditional
  const [pageSize, setPageSize] = useState(5);
  const pageOptions = [5, 10, 20, 50].map((n) => ({
    value: n,
    label: t("pagination.pageSizeOptions", { n })
  }));

  const recipes: RecipeRow[] = useMemo(() => {
    const list = accountInfo?.recipes ?? [];
    return list.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? t("untitledRecipe")
    }));
  }, [accountInfo?.recipes, t]);

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
    data: recipes,
    pageSize,
    searchKey: "name"
  });

  const [linkingRecipeId, setLinkingRecipeId] = useState<number | null>(null);

  // ---- Skeleton (page-level) ----
  if (isLoading) {
    return <LinkBrewSkeleton />;
  }

  if (isError || !brew) {
    return (
      <div className="my-6">
        <h2 className="text-2xl">{t("iSpindelDashboard.brews.link")}</h2>
        <p className="text-destructive mt-3">
          {t("iSpindelDashboard.brews.linkError")}
        </p>
      </div>
    );
  }

  return (
    <div className="my-6">
      <h2 className="text-2xl">{t("iSpindelDashboard.brews.link")}</h2>

      <PagedResults
        scroll
        scrollClassName="sm:max-h-[60vh]"
        controls={
          <div className="grid gap-2 sm:gap-3 mt-4">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm font-medium whitespace-nowrap">
                  {t("searchLabel")}:
                </label>

                <InputGroup className="w-full sm:max-w-sm">
                  <InputGroupInput
                    value={searchValue}
                    onChange={(e) => search(e.target.value)}
                    placeholder={t(
                      "iSpindelDashboard.recipes.searchPlaceholder"
                    )}
                  />
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      title={t("clearSearch")}
                      onClick={clearSearch}
                      className={cn({ hidden: searchValue.length === 0 })}
                    >
                      <X />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              {/* Per page (desktop only) */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium whitespace-nowrap">
                  {t("pagination.perPage")}
                </span>

                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => setPageSize(parseInt(val, 10))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        }
        footer={
          filteredData.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              <AccountPagination
                page={page}
                totalPages={totalPages}
                canPrev={page > 1}
                canNext={page < totalPages}
                onPrev={prevPage}
                onNext={nextPage}
                onGoTo={goToPage}
              />
            </div>
          ) : null
        }
      >
        <div className="flex flex-wrap justify-center gap-4 py-2">
          {pageData.length > 0 ? (
            pageData.map((rec) => (
              <RecipeLinkCard
                key={rec.id}
                recipe={rec}
                isCurrent={rec.id === Number(brew.recipe_id)}
                isLinking={linkingRecipeId === rec.id && linkMutation.isPending}
                disableAll={linkMutation.isPending}
                onLink={async () => {
                  try {
                    setLinkingRecipeId(rec.id);
                    await linkMutation.mutateAsync({
                      brewId,
                      recipeId: rec.id
                    });
                    router.replace(`/account/hydrometer/logs/${brewId}`);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setLinkingRecipeId(null);
                  }
                }}
              />
            ))
          ) : (
            <p className="w-full text-center mt-6">
              {t("accountPage.noRecipes")}
            </p>
          )}
        </div>
      </PagedResults>

      {recipes.length === 0 && (
        <div className="flex items-center justify-center my-10">
          <p>{t("accountPage.noRecipes")}</p>
        </div>
      )}
    </div>
  );
}

export default LinkBrew;

function LinkBrewSkeleton() {
  return (
    <div className="my-6 space-y-4">
      {/* Title */}
      <Skeleton className="h-8 w-[240px]" />

      {/* Controls row */}
      <div className="grid gap-2 sm:gap-3 mt-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-5 w-[72px]" />
            <Skeleton className="h-9 w-full sm:max-w-sm rounded-md" />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-5 w-[90px]" />
            <Skeleton className="h-9 w-[140px] rounded-md" />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-4 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="w-full sm:w-[20rem] lg:w-[18rem] xl:w-[20rem] sm:max-w-none"
          >
            {/* Title */}
            <CardHeader className="p-3 pb-2">
              <Skeleton className="h-5 w-[75%] mx-auto" />
            </CardHeader>

            {/* Button group (connected) */}
            <CardContent className="p-3 pt-0">
              <div className="flex w-full items-stretch">
                <Skeleton className="h-9 flex-1 rounded-r-none" />
                <Skeleton className="h-9 flex-1 rounded-l-none -ml-px" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer pagination */}
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-10 w-[260px]" />
      </div>
    </div>
  );
}

const RecipeLinkCard = ({
  recipe,
  isCurrent,
  isLinking,
  disableAll,
  onLink
}: {
  recipe: { id: number; name: string };
  isCurrent: boolean;
  isLinking: boolean;
  disableAll: boolean;
  onLink: () => Promise<void>;
}) => {
  const { t } = useTranslation();

  return (
    <Card className="w-full sm:w-[20rem] lg:w-[18rem] xl:w-[20rem] sm:max-w-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-base leading-snug text-center line-clamp-2">
          {recipe.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-2">
        <ButtonGroup className="w-full">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={disableAll}
          >
            <Link href={`/recipes/${recipe.id}`}>
              {t("accountPage.viewRecipe")}
            </Link>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="flex-1"
            disabled={isCurrent || disableAll}
            onClick={onLink}
          >
            {isCurrent
              ? t("iSpindelDashboard.brews.currentRecipeShort")
              : isLinking
              ? t("linking")
              : t("iSpindelDashboard.brews.link")}
          </Button>
        </ButtonGroup>

        {isCurrent && (
          <p className="text-xs text-muted-foreground text-center">
            {t("iSpindelDashboard.brews.currentRecipe")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
