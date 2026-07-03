"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

import { AccountPagination } from "@/components/account/pagination";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { PagedResults } from "@/components/ui/paged-results";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import {
  useAccountBrew,
  usePatchAccountBrewMetadata
} from "@/hooks/reactQuery/useAccountBrews";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { cn } from "@/lib/utils";

type RecipeRow = {
  id: number;
  name: string;
};

export default function LinkAccountBrewRecipePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const brewId = params.brew_id as string;

  const {
    data: brew,
    isLoading: brewLoading,
    isError: brewError
  } = useAccountBrew(brewId);
  const {
    data: accountInfo,
    isLoading: accountLoading,
    isError: accountError
  } = useAccountInfo();
  const patchBrew = usePatchAccountBrewMetadata();

  const [pageSize, setPageSize] = useState(5);
  const [linkingRecipeId, setLinkingRecipeId] = useState<number | null>(null);

  const recipes: RecipeRow[] = useMemo(() => {
    const list = accountInfo?.recipes ?? [];
    return list.map((recipe: any) => ({
      id: Number(recipe.id),
      name: recipe.name ?? t("untitledRecipe", "Untitled recipe")
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

  const isLoading = brewLoading || accountLoading;
  const isError = brewError || accountError;
  const pageOptions = [5, 10, 20, 50].map((n) => ({
    value: n,
    label: t("pagination.pageSizeOptions", { n })
  }));

  if (isLoading) {
    return <LinkRecipeSkeleton />;
  }

  if (isError || !brew) {
    return (
      <div className="my-6">
        <h2 className="text-2xl">
          {t("brews.planned.linkRecipeTitle", "Link a recipe")}
        </h2>
        <p className="text-destructive mt-3">
          {t("error", "Something went wrong.")}
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">
            {t("brews.planned.linkRecipeTitle", "Link a recipe")}
          </h2>
          <div className="text-sm text-muted-foreground">
            {brew.name ?? brew.id}
          </div>
        </div>

        <Button variant="secondary" asChild>
          <Link href={`/account/brews/${brewId}`}>{t("back", "Back")}</Link>
        </Button>
      </div>

      <PagedResults
        scroll
        scrollClassName="sm:max-h-[60vh]"
        controls={
          <div className="grid gap-2 sm:gap-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm font-medium whitespace-nowrap">
                  {t("searchLabel", "Search")}:
                </label>

                <InputGroup className="w-full sm:max-w-sm">
                  <InputGroupInput
                    value={searchValue}
                    onChange={(e) => search(e.target.value)}
                    placeholder={t("search", "Search")}
                    disabled={patchBrew.isPending}
                  />
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      title={t("clearSearch", "Clear search")}
                      onClick={clearSearch}
                      className={cn({ hidden: searchValue.length === 0 })}
                      disabled={patchBrew.isPending}
                    >
                      <X />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium whitespace-nowrap">
                  {t("pagination.perPage", "Per page")}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => setPageSize(parseInt(val, 10))}
                  disabled={patchBrew.isPending}
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
            pageData.map((recipe) => (
              <RecipeLinkCard
                key={recipe.id}
                recipe={recipe}
                isCurrent={recipe.id === Number(brew.recipe_id)}
                isLinking={linkingRecipeId === recipe.id && patchBrew.isPending}
                disableAll={patchBrew.isPending}
                onLink={async () => {
                  try {
                    setLinkingRecipeId(recipe.id);
                    await patchBrew.mutateAsync({
                      brewId,
                      input: { recipe_id: recipe.id }
                    });
                    toast({
                      description: t("saved", "Saved.")
                    });
                    router.replace(`/account/brews/${brewId}`);
                  } catch (err) {
                    console.error(err);
                    toast({
                      description: t("error", "Something went wrong."),
                      variant: "destructive"
                    });
                  } finally {
                    setLinkingRecipeId(null);
                  }
                }}
              />
            ))
          ) : (
            <p className="w-full text-center mt-6">
              {filteredData.length === 0
                ? t("noResults", "No results found.")
                : t("accountPage.noRecipes", "No recipes found.")}
            </p>
          )}
        </div>
      </PagedResults>

      {recipes.length === 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-3 my-10">
          <p>{t("accountPage.noRecipes", "No recipes found.")}</p>
          <Button asChild>
            <Link href="/recipe-building">
              {t("brews.planned.createRecipe", "Create recipe")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RecipeLinkCard({
  recipe,
  isCurrent,
  isLinking,
  disableAll,
  onLink
}: {
  recipe: RecipeRow;
  isCurrent: boolean;
  isLinking: boolean;
  disableAll: boolean;
  onLink: () => Promise<void>;
}) {
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
              {t("accountPage.viewRecipe", "View recipe")}
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
              ? t("iSpindelDashboard.brews.currentRecipeShort", "Current")
              : isLinking
                ? t("linking", "Linking...")
                : t("brews.planned.linkRecipeAction", "Link recipe")}
          </Button>
        </ButtonGroup>

        {isCurrent ? (
          <p className="text-xs text-muted-foreground text-center">
            {t("iSpindelDashboard.brews.currentRecipe", "Current recipe")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinkRecipeSkeleton() {
  return (
    <div className="my-6 space-y-4">
      <Skeleton className="h-8 w-[240px]" />
      <Skeleton className="h-9 w-full sm:max-w-sm rounded-md" />
      <div className="flex flex-wrap justify-center gap-4 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="w-full sm:w-[20rem] lg:w-[18rem] xl:w-[20rem] sm:max-w-none"
          >
            <CardHeader className="p-3 pb-2">
              <Skeleton className="h-5 w-[75%] mx-auto" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex w-full items-stretch">
                <Skeleton className="h-9 flex-1 rounded-r-none" />
                <Skeleton className="h-9 flex-1 rounded-l-none -ml-px" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
