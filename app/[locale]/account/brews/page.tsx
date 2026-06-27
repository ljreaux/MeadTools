"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Search, Trash2, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
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
import { BREW_STAGE } from "@/lib/brewEnums";
import { toast } from "@/hooks/use-toast";

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
  useDeleteAccountBrew
} from "@/hooks/reactQuery/useAccountBrews";
import {
  BrewList,
  type BrewListDisplayItem,
  type BrewListSortKey,
  type BrewListSortDirection
} from "@/components/brews/BrewList";

const ALL_STAGES = "all";
const ALL_RECIPES = "all";
const NO_RECIPE = "none";

function getDateTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export default function AccountBrews() {
  const { t } = useTranslation();
  const { data: brews = [], isLoading, isError, error } = useAccountBrews();
  const deleteBrewMutation = useDeleteAccountBrew();

  const [pageSize, setPageSize] = useState(10);
  const [stageFilter, setStageFilter] = useState(ALL_STAGES);
  const [recipeFilter, setRecipeFilter] = useState(ALL_RECIPES);
  const [sort, setSort] = useState<{
    key: BrewListSortKey;
    direction: BrewListSortDirection;
  } | null>(null);
  const [deletingBrewId, setDeletingBrewId] = useState<string | null>(null);

  const recipeOptions = useMemo(() => {
    const recipes = new Map<number, string>();

    brews.forEach((brew) => {
      if (brew.recipe_id) {
        recipes.set(
          brew.recipe_id,
          brew.recipe_name || String(brew.recipe_id)
        );
      }
    });

    return Array.from(recipes, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [brews]);

  const filteredBrews = useMemo(() => {
    return brews.filter((brew) => {
      if (stageFilter !== ALL_STAGES && brew.stage !== stageFilter) {
        return false;
      }

      if (recipeFilter === NO_RECIPE && brew.recipe_id) {
        return false;
      }

      if (
        recipeFilter !== ALL_RECIPES &&
        recipeFilter !== NO_RECIPE &&
        brew.recipe_id !== Number(recipeFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [brews, recipeFilter, stageFilter]);

  const sortBy = useMemo(() => {
    if (!sort) return undefined;

    return [
      (a: BrewListDisplayItem, b: BrewListDisplayItem) => {
        const aTime = getDateTime(a[sort.key]);
        const bTime = getDateTime(b[sort.key]);

        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return sort.direction === "asc" ? 1 : -1;
        if (bTime === null) return sort.direction === "asc" ? -1 : 1;

        return sort.direction === "asc" ? aTime - bTime : bTime - aTime;
      }
    ];
  }, [sort]);

  const clearFilters = () => {
    setStageFilter(ALL_STAGES);
    setRecipeFilter(ALL_RECIPES);
  };

  const hasFilters =
    stageFilter !== ALL_STAGES || recipeFilter !== ALL_RECIPES;

  const handleSort = (key: BrewListSortKey) => {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc"
        };
      }

      return { key, direction: "desc" };
    });
  };

  const handleDeleteBrew = async (brew: BrewListDisplayItem) => {
    try {
      setDeletingBrewId(brew.id);
      await deleteBrewMutation.mutateAsync(brew.id);
      toast({ description: t("brews.delete.success", "Brew deleted.") });
    } catch {
      toast({
        description: t(
          "brews.delete.error",
          "Something went wrong deleting this brew."
        ),
        variant: "destructive"
      });
    } finally {
      setDeletingBrewId(null);
    }
  };

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
    data: filteredBrews,
    pageSize,
    searchKey: ["name", "id", "recipe_name", "stage"],
    sortBy
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("brews.stage")}
          </span>
          <Select
            value={stageFilter}
            onValueChange={setStageFilter}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STAGES}>
                {t("brews.filters.allStages", "All stages")}
              </SelectItem>
              {Object.values(BREW_STAGE).map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {t(`brewStage.${stage}`, stage)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("brews.filters.recipe.label", "Recipe")}
          </span>
          <Select
            value={recipeFilter}
            onValueChange={setRecipeFilter}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RECIPES}>
                {t("brews.filters.recipe.all", "All recipes")}
              </SelectItem>
              <SelectItem value={NO_RECIPE}>
                {t("brews.filters.recipe.none", "No linked recipe")}
              </SelectItem>
              {recipeOptions.map((recipe) => (
                <SelectItem key={recipe.id} value={String(recipe.id)}>
                  {recipe.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isLoading}
          >
            <X />
            {t("brews.filters.clear", "Clear filters")}
          </Button>
        ) : null}
      </div>

      {showEmptyState ? (
        <div className="text-center my-4">
          {searchValue || hasFilters ? t("noResults") : t("brews.none")}
        </div>
      ) : (
        <>
          <BrewList
            brews={pageData}
            detailHref={(brewId) => `/account/brews/${brewId}`}
            loading={isLoading}
            loadingRows={pageSize}
            sort={sort}
            onSort={handleSort}
            renderActions={(brew) => (
              <DeleteBrewButton
                brew={brew}
                isDeleting={deletingBrewId === brew.id}
                onDelete={handleDeleteBrew}
              />
            )}
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

function DeleteBrewButton({
  brew,
  isDeleting,
  onDelete
}: {
  brew: BrewListDisplayItem;
  isDeleting: boolean;
  onDelete: (brew: BrewListDisplayItem) => Promise<void>;
}) {
  const { t } = useTranslation();
  const brewName = brew.name || brew.id;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          title={t("brews.delete.confirm", "Delete brew")}
          disabled={isDeleting}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("brews.delete.title", "Delete this brew?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "brews.delete.description",
              "This will permanently delete {{name}} and its timeline entries. Linked hydrometer devices will be detached, and wireless logs for this brew will also be deleted. This action cannot be undone.",
              { name: brewName }
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t("cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(brew)}
              disabled={isDeleting}
            >
              {isDeleting
                ? t("brews.delete.deleting", "Deleting...")
                : t("brews.delete.confirm", "Delete brew")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
