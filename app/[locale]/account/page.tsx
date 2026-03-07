"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useUpdatePublicUsername } from "@/hooks/reactQuery/useUpdatePublicUsername";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import { useDeleteRecipe } from "@/hooks/reactQuery/useDeleteRecipe";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Loading from "@/components/loading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowUpAZ,
  ArrowDownAZ,
  Hash,
  RotateCcw,
  SortAsc,
  SortDesc,
  Trash2,
  Search,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { cn } from "@/lib/utils";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";
import { AccountPagination } from "@/components/account/pagination";
import { PagedResults } from "@/components/ui/paged-results";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";

import { ButtonGroup } from "@/components/ui/button-group";
import { useAccountRecipeSortPrefs } from "@/hooks/useAccountRecipeSortPrefs";
import Header from "@/components/account/header";

type SortType = "asc" | "dec" | "clear";

function Account() {
  const { t } = useTranslation();

  const { data, isLoading, isError, error } = useAccountInfo();

  const [isUsernameDialogOpen, setUsernameDialogOpen] = useState(false);

  const searchKey = "name";
  const options = [5, 10, 20, 50].map((num) => ({
    value: num,
    label: t("pagination.pageSizeOptions", { n: num })
  }));

  const [sortBy, setSortBy] = useState<
    Record<
      string,
      (fieldOne: RecipeApiResponse, fieldTwo: RecipeApiResponse) => number
    >
  >({});
  const {
    pageSize,
    setPageSize,
    sortField,
    setSortField,
    sortDir,
    setSortDir
  } = useAccountRecipeSortPrefs();

  const deleteRecipeMutation = useDeleteRecipe();

  // Pull recipes from React Query result
  const recipes = data?.recipes ?? [];

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
    searchKey,
    sortBy: Object.values(sortBy)
  });

  const nameAlpha = (a: RecipeApiResponse, b: RecipeApiResponse) => {
    return a.name.localeCompare(b.name);
  };

  const nameReverse = (a: RecipeApiResponse, b: RecipeApiResponse) => {
    return b.name.localeCompare(a.name);
  };

  const sortAlphabetically = (filtering: SortType) => {
    const copy = { ...sortBy };
    if (filtering === "asc") {
      delete copy.nameReverse;
      setSortBy({ ...copy, nameAlpha });
    } else if (filtering === "dec") {
      delete copy.nameAlpha;
      setSortBy({ ...copy, nameReverse });
    } else {
      delete copy.nameReverse;
      delete copy.nameAlpha;
      setSortBy({ ...copy });
    }
  };

  const recipeId = (a: RecipeApiResponse, b: RecipeApiResponse) => {
    return a.id - b.id;
  };

  const recipeIdReverse = (a: RecipeApiResponse, b: RecipeApiResponse) => {
    return b.id - a.id;
  };

  const sortById = (filtering: SortType) => {
    const copy = { ...sortBy };
    if (filtering === "asc") {
      delete copy.recipeIdReverse;
      setSortBy({ ...copy, recipeId });
    } else if (filtering === "dec") {
      delete copy.recipeId;
      setSortBy({ ...copy, recipeIdReverse });
    } else {
      delete copy.recipeIdReverse;
      delete copy.recipeId;
      setSortBy({ ...copy });
    }
  };

  const deleteIndividualRecipe = async (id: number) => {
    try {
      await deleteRecipeMutation.mutateAsync(id);
      // cache update happens in useDeleteRecipe.onSuccess
    } catch (err) {
      console.error("Error deleting recipe:", err);
    }
  };

  useEffect(() => {
    if (sortField === "default") {
      sortAlphabetically("clear");
      sortById("clear");
      return;
    }

    if (sortField === "name") {
      sortById("clear");
      sortAlphabetically(sortDir);
    } else if (sortField === "id") {
      sortAlphabetically("clear");
      sortById(sortDir);
    }
  }, [sortField, sortDir]);

  // Open "create username" dialog if user is missing one
  useEffect(() => {
    if (!isLoading && data?.user.public_username == null) {
      setUsernameDialogOpen(true);
    }
  }, [isLoading, data?.user.public_username]);

  if (isLoading || !data) return <Loading />;

  if (isError) {
    console.error("Error loading account info:", error);
    return (
      <div className="p-12 py-8 rounded-xl bg-background w-11/12 max-w-[1000px]">
        <p className="text-destructive text-center">{t("accountPage.error")}</p>
      </div>
    );
  }

  const { user } = data;

  return (
    <div className="p-8 sm:p-12 py-8 rounded-xl bg-background w-11/12 max-w-[1200px] relative">
      <Header />
      <h1 className="text-3xl text-center">{t("accountPage.title")}</h1>
      <CreateUsernamePopup
        isDialogOpen={isUsernameDialogOpen}
        closeDialog={() => setUsernameDialogOpen(false)}
      />
      <p>
        {t("greeting")} {user.public_username || user.email}!
      </p>
      <div className="my-6">
        <h2 className="text-2xl">{t("accountPage.myRecipes")}</h2>

        <PagedResults
          // Optional later:
          scroll
          scrollClassName="sm:max-h-[60vh]"
          controls={
            <div className="grid gap-2 sm:gap-3">
              {/* Row 1: Search + Per-page (per-page hidden on mobile) */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-sm font-medium whitespace-nowrap">
                    {t("searchLabel")}
                  </label>

                  <InputGroup className="w-full sm:max-w-sm">
                    <InputGroupInput
                      id="search"
                      value={searchValue}
                      onChange={(e) => search(e.target.value)}
                      placeholder={`Search ${
                        Array.isArray(searchKey)
                          ? searchKey.map((key) => String(key)).join(", ")
                          : String(searchKey)
                      }`}
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
                    onValueChange={(val) => setPageSize(parseInt(val))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value.toString()}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Sort (mobile breaks into 2 lines; toggles forced to line 2 on mobile) */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  {t("sortLabel")}
                </label>

                <Select
                  value={sortField}
                  onValueChange={(v) =>
                    setSortField(v as "default" | "name" | "id")
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      {t("sortLabels.default")}
                    </SelectItem>
                    <SelectItem value="name">
                      <span className="inline-flex items-center gap-2">
                        <ArrowUpAZ className="h-4 w-4" /> {t("sortLabels.name")}
                      </span>
                    </SelectItem>
                    <SelectItem value="id">
                      <span className="inline-flex items-center gap-2">
                        <Hash className="h-4 w-4" /> {t("sortLabels.id")}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Mobile: push toggles + reset to next line */}
                <div className="w-full sm:w-auto flex items-center gap-2 sm:ml-1">
                  <ToggleGroup
                    type="single"
                    value={sortDir}
                    onValueChange={(v) => v && setSortDir(v as "asc" | "dec")}
                  >
                    <ToggleGroupItem value="asc" aria-label="Ascending">
                      {sortField === "name" ? (
                        <ArrowUpAZ className="h-4 w-4" />
                      ) : (
                        <SortAsc className="h-4 w-4" />
                      )}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dec" aria-label="Descending">
                      {sortField === "name" ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <SortDesc className="h-4 w-4" />
                      )}
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSortField("default")}
                    title="Reset sort"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
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
          <div className="flex flex-wrap justify-center gap-4 py-2 max-w-[70rem] mx-auto">
            {pageData.length > 0 ? (
              pageData.map((rec) => (
                <RecipeCard
                  recipe={rec}
                  key={rec.id}
                  deleteRecipe={() => deleteIndividualRecipe(rec.id)}
                />
              ))
            ) : (
              <p className="justify-self-start">{t("accountPage.noRecipes")}</p>
            )}
          </div>
        </PagedResults>
      </div>
    </div>
  );
}

export default Account;

const RecipeCard = ({
  recipe,
  deleteRecipe
}: {
  recipe: RecipeApiResponse;
  deleteRecipe: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecipe();
    } catch (err) {
      console.error("Error deleting recipe:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="w-full sm:w-[20rem] lg:w-[18rem] xl:w-[20rem] sm:max-w-none">
      <CardHeader className="p-3 pb-2 relative">
        <LoadingButton
          variant="destructive"
          size="icon"
          loading={isDeleting}
          onClick={handleDelete}
          className="absolute right-1.5 top-1.5 h-8 w-8"
          title={t("accountPage.deleteRecipe")}
        >
          <span className="sr-only">{t("accountPage.deleteRecipe")}</span>
          <Trash2 />
        </LoadingButton>

        <CardTitle className="text-base leading-snug text-center line-clamp-2 px-7">
          {recipe.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <ButtonGroup className="w-full">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="flex-1 justify-center"
          >
            <Link href={`recipes/${recipe.id}`}>
              {t("accountPage.viewRecipe")}
            </Link>
          </Button>

          <Button
            asChild
            variant="secondary"
            size="sm"
            className="flex-1 justify-center"
          >
            <Link href={`recipes/${recipe.id}?pdf=true`}>{t("PDF.title")}</Link>
          </Button>
        </ButtonGroup>
      </CardContent>
    </Card>
  );
};

const CreateUsernamePopup = ({
  isDialogOpen,
  closeDialog
}: {
  isDialogOpen: boolean;
  closeDialog: () => void;
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const updateUsernameMutation = useUpdatePublicUsername();
  return (
    <AlertDialog open={isDialogOpen} onOpenChange={closeDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("publicUsername.title")}</AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            {t("publicUsername.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div>
          <Input
            type="text"
            placeholder={t("publicUsername.placeholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={closeDialog}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              updateUsernameMutation.mutate(username);
              closeDialog();
            }}
          >
            {t("SUBMIT")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
