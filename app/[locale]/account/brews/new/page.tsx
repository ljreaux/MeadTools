"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import { useCreateAccountBrew } from "@/hooks/reactQuery/useAccountBrews";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountPagination } from "@/components/account/pagination";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type RecipeRow = { id: number; name: string };

export default function NewBrewClient() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: accountInfo, isLoading, isError, error } = useAccountInfo();
  const createMutation = useCreateAccountBrew();

  const recipes: RecipeRow[] = useMemo(() => {
    const list = accountInfo?.recipes ?? [];
    return list.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? t("untitledRecipe", "Untitled recipe")
    }));
  }, [accountInfo?.recipes, t]);

  const [pageSize] = useState(10);
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

  // optional “draft” fields for the new brew
  const [nameDraft, setNameDraft] = useState<string>("");
  const [volumeDraft, setVolumeDraft] = useState<string>("");

  if (isError) {
    console.error(error);
    return (
      <div className="text-center my-6">
        {t("error.generic", "Something went wrong.")}
      </div>
    );
  }

  if (isLoading) return <NewBrewSkeleton />;

  return (
    <div className="w-11/12 max-w-[1200px] relative rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
      <div className="my-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">{t("brews.new", "New Brew")}</h2>

          <Button variant="secondary" asChild>
            <Link href="/account/brews">{t("back", "Back")}</Link>
          </Button>
        </div>

        {/* Optional: basic setup fields */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            {t(
              "brews.new.help",
              "Pick a recipe to start a brew. (Optional) set a name and starting volume."
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">{t("name", "Name")}</div>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t(
                  "brews.new.namePlaceholder",
                  "e.g. January Batch"
                )}
                disabled={createMutation.isPending}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">
                {t("brews.new.volumeLiters", "Starting volume (L)")}
              </div>
              <Input
                value={volumeDraft}
                onChange={(e) => setVolumeDraft(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                disabled={createMutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <InputGroup className="w-full sm:max-w-sm">
            <InputGroupInput
              value={searchValue}
              onChange={(e) => search(e.target.value)}
              placeholder={t("search", "Search")}
              disabled={createMutation.isPending}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                title={t("clear", "Clear")}
                onClick={clearSearch}
                className={cn({ hidden: searchValue.length === 0 })}
                disabled={createMutation.isPending}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {/* page size (you can reuse your Select UI if you want; keeping it minimal) */}
        </div>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-4 py-2">
          {pageData.length > 0 ? (
            pageData.map((rec) => (
              <RecipeStartCard
                key={rec.id}
                recipe={rec}
                isCreating={createMutation.isPending}
                onStart={async () => {
                  try {
                    const vol =
                      volumeDraft.trim().length === 0
                        ? undefined
                        : Number(volumeDraft);

                    if (vol !== undefined && !Number.isFinite(vol)) {
                      toast({
                        description: t(
                          "error.invalidNumber",
                          "Invalid number."
                        ),
                        variant: "destructive"
                      });
                      return;
                    }

                    const brew = await createMutation.mutateAsync({
                      recipe_id: rec.id,
                      name: nameDraft.trim() ? nameDraft.trim() : undefined,
                      current_volume_liters: vol
                    });

                    router.push(`/account/brews/${brew.id}`);
                  } catch (e) {
                    console.error(e);
                    toast({
                      description: t("error.generic", "Something went wrong."),
                      variant: "destructive"
                    });
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

        {/* Pagination */}
        {filteredData.length > 0 && totalPages > 1 && (
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
      </div>
    </div>
  );
}

function RecipeStartCard({
  recipe,
  isCreating,
  onStart
}: {
  recipe: { id: number; name: string };
  isCreating: boolean;
  onStart: () => Promise<void>;
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
            disabled={isCreating}
          >
            <Link href={`/recipes/${recipe.id}`}>{t("open", "Open")}</Link>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="flex-1"
            disabled={isCreating}
            onClick={onStart}
          >
            {isCreating ? t("creating", "Creating...") : t("start", "Start")}
          </Button>
        </ButtonGroup>
      </CardContent>
    </Card>
  );
}

function NewBrewSkeleton() {
  return (
    <div className="w-11/12 max-w-[1200px] relative rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
      <div className="my-6 space-y-4">
        <Skeleton className="h-8 w-[220px]" />
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-[520px]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
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
    </div>
  );
}
