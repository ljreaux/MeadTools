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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PagedResults } from "@/components/ui/paged-results";
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
    data: recipes,
    pageSize,
    searchKey: "name"
  });

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRow | null>(null);
  const [nameDraft, setNameDraft] = useState<string>("");

  if (isError) {
    console.error(error);
    return (
      <div className="text-center my-6">
        {t("error", "Something went wrong.")}
      </div>
    );
  }

  if (isLoading) return <NewBrewSkeleton />;

  const openStartDialog = (recipe: RecipeRow) => {
    setSelectedRecipe(recipe);
    setNameDraft(recipe.name);
  };

  const createSelectedBrew = async () => {
    if (!selectedRecipe) return;

    try {
      const brew = await createMutation.mutateAsync({
        recipe_id: selectedRecipe.id,
        name: nameDraft.trim() ? nameDraft.trim() : selectedRecipe.name
      });

      setSelectedRecipe(null);
      router.push(`/account/brews/${brew.id}`);
    } catch (e) {
      console.error(e);
      toast({
        description: t("error", "Something went wrong."),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="my-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl">{t("brews.new", "New Brew")}</h2>

        <Button variant="secondary" asChild>
          <Link href="/account/brews">{t("back", "Back")}</Link>
        </Button>
      </div>

      <PagedResults
        scroll
        scrollClassName="sm:max-h-[60vh]"
        controls={
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {t("brews.newBrew.help", "Pick a recipe to start a brew. You can name the brew before it is created.")}
            </p>
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

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium whitespace-nowrap">
                  {t("pagination.perPage", "Per page")}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => setPageSize(parseInt(val, 10))}
                  disabled={createMutation.isPending}
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
              </div>
            </div>
          </div>
        }
        footer={
          filteredData.length > 0 && totalPages > 1 ? (
            <AccountPagination
              page={page}
              totalPages={totalPages}
              canPrev={page > 1}
              canNext={page < totalPages}
              onPrev={prevPage}
              onNext={nextPage}
              onGoTo={goToPage}
            />
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pageData.length > 0 ? (
            pageData.map((rec) => (
              <RecipeStartCard
                key={rec.id}
                recipe={rec}
                isCreating={createMutation.isPending}
                onStart={() => openStartDialog(rec)}
              />
            ))
          ) : (
            <p className="col-span-full text-center mt-6">
              {recipes.length === 0
                ? t("accountPage.noRecipes", "No recipes found.")
                : t("noResults", "No results found.")}
            </p>
          )}
        </div>
      </PagedResults>

      <Dialog
        open={Boolean(selectedRecipe)}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) setSelectedRecipe(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("brews.newBrew.confirmTitle", "Start brew")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {selectedRecipe
                ? t("brews.newBrew.confirmHelp", "Create a brew from {{recipeName}}.", {
                    recipeName: selectedRecipe.name
                  })
                : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-brew-name">{t("name", "Name")}</Label>
              <Input
                id="new-brew-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t("brews.newBrew.namePlaceholder", "e.g. January Batch")}
                disabled={createMutation.isPending}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedRecipe(null)} disabled={createMutation.isPending}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={createSelectedBrew} disabled={createMutation.isPending || !selectedRecipe}>
              {createMutation.isPending ? t("creating", "Creating...") : t("start", "Start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onStart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="w-full">
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
        <Skeleton className="h-4 w-full max-w-[520px]" />
        <Skeleton className="h-9 w-full sm:max-w-sm rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="w-full"
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
