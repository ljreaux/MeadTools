"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

import Loading from "@/components/loading";
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

  const [pageSize, setPageSize] = useState(5);
  const pageOptions = [5, 10, 20, 50].map((n) => ({
    value: n,
    label: `${n} items`
  }));

  const recipes: RecipeRow[] = useMemo(() => {
    const list = accountInfo?.recipes ?? [];
    return list.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? t("untitledRecipe", "Untitled recipe")
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

  if (isLoading) return <Loading />;

  if (isError || !brew) {
    return (
      <div className="my-6">
        <h2 className="text-2xl">{t("iSpindelDashboard.brews.link")}</h2>
        <p className="text-destructive mt-3">
          {t(
            "iSpindelDashboard.brews.linkError",
            "Unable to load brew or recipes."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="my-6">
      {/* Title */}
      <h2 className="text-2xl">{t("iSpindelDashboard.brews.link")}</h2>

      {/* Controls (match devices/account style) */}
      <PagedResults
        scroll
        scrollClassName="sm:max-h-[60vh]"
        controls={
          <div className="grid gap-2 sm:gap-3 mt-4">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm font-medium whitespace-nowrap">
                  {t("search", "Search")}:
                </label>

                <InputGroup className="w-full sm:max-w-sm">
                  <InputGroupInput
                    value={searchValue}
                    onChange={(e) => search(e.target.value)}
                    placeholder={t(
                      "iSpindelDashboard.recipes.searchPlaceholder",
                      "Search recipes"
                    )}
                  />
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      title={t("clear", "Clear")}
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
                  {t("pagination.perPage", "Per page:")}
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
        {/* Cards */}
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
              {t("iSpindelDashboard.recipes.noResults", "No matching recipes.")}
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
              ? t("iSpindelDashboard.brews.currentRecipeShort", "Linked")
              : isLinking
                ? t("linking", "Linking…")
                : t("iSpindelDashboard.brews.link")}
          </Button>
        </ButtonGroup>

        {isCurrent && (
          <p className="text-xs text-muted-foreground text-center">
            {t(
              "iSpindelDashboard.brews.currentRecipe",
              "This recipe is already linked to this brew."
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
