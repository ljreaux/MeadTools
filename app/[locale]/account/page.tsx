"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useLogout } from "@/hooks/reactQuery/useLogout";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import Loading from "@/components/loading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowUpAZ,
  ArrowDownAZ,
  Hash,
  RotateCcw,
  SortAsc,
  SortDesc,
  LogOut,
  LucideX,
  Settings
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ModeToggle } from "@/components/ui/mode-toggle";
import LanguageSwitcher from "@/components/ui/language-switcher";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { cn } from "@/lib/utils";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";

type SortType = "asc" | "dec" | "clear";

function Account() {
  const { t } = useTranslation();

  const { logout } = useLogout();

  // new account info hook (user + recipes)
  const { data, isLoading, isError, error } = useAccountInfo();

  const [isUsernameDialogOpen, setUsernameDialogOpen] = useState(false);

  const searchKey = "name";
  const [pageSize, setPageSize] = useState(5);
  const options = [5, 10, 20, 50].map((num) => ({
    value: num,
    label: `${num} items`
  }));

  const [sortBy, setSortBy] = useState<
    Record<
      string,
      (fieldOne: RecipeApiResponse, fieldTwo: RecipeApiResponse) => number
    >
  >({});
  const [sortField, setSortField] = useState<"default" | "name" | "id">(
    "default"
  );
  const [sortDir, setSortDir] = useState<"asc" | "dec">("asc");

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
    totalPages,
    start,
    end
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
        <p className="text-destructive text-center">
          {t("accountPage.error", "Error loading account information.")}
        </p>
      </div>
    );
  }

  const { user } = data;

  return (
    <div className="p-12 py-8 rounded-xl bg-background w-11/12 max-w-[1000px] relative">
      <div className="absolute right-4 top-4 flex flex-col sm:flex-row">
        <SettingsDialog username={user.public_username} />
        <Button onClick={logout} variant={"ghost"}>
          <p className="sr-only">Log Out</p>
          <LogOut />
        </Button>
      </div>
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
        <div className="flex items center sm:justify-between flex-wrap sm:flex-nowrap gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="search" className="text-sm font-medium">
              Search:
            </label>
            <div className="relative max-w-sm">
              <Input
                id="search"
                value={searchValue}
                onChange={(e) => {
                  search(e.target.value);
                }}
                placeholder={`Search ${
                  Array.isArray(searchKey)
                    ? searchKey.map((key) => String(key)).join(", ")
                    : String(searchKey)
                }`}
                className="pr-8"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <LucideX />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <label className="text-sm font-medium">Sort</label>

            {/* Field selector */}
            <Select
              value={sortField}
              onValueChange={(v) =>
                setSortField(v as "default" | "name" | "id")
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="name">
                  <span className="inline-flex items-center gap-2">
                    <ArrowUpAZ className="h-4 w-4" /> Name
                  </span>
                </SelectItem>
                <SelectItem value="id">
                  <span className="inline-flex items-center gap-2">
                    <Hash className="h-4 w-4" /> ID
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Direction toggle */}
            <ToggleGroup
              type="single"
              value={sortDir}
              onValueChange={(v) => v && setSortDir(v as "asc" | "dec")}
              className="ml-1"
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

            {/* Reset button */}
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
        <div className="flex flex-wrap gap-4 justify-center py-6">
          {pageData.length > 0 ? (
            pageData.map((rec) => (
              <RecipeCard
                recipe={rec}
                key={rec.id}
                deleteRecipe={() => deleteIndividualRecipe(rec.id)}
              />
            ))
          ) : (
            <p className="mr-auto">{t("accountPage.noRecipes")}</p>
          )}
        </div>
      </div>
      {filteredData.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
          <span className="flex gap-4 items-center">
            <p>
              {t("pagination.showing", {
                start: start + 1,
                end: Math.min(end, filteredData.length),
                total: filteredData.length
              })}
            </p>
            <span className="max-w-max sm:block hidden">
              <Select
                defaultValue={options[0].value.toString()}
                onValueChange={(val) => setPageSize(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </span>

          <div className="flex items-center gap-4">
            <Button disabled={page === 1} onClick={prevPage}>
              {t("pagination.previous")}
            </Button>
            <span>{t("pagination.pageInfo", { page, totalPages })}</span>
            <Button disabled={page >= totalPages} onClick={nextPage}>
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
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
  const [isDeleting, setIsDeleting] = React.useState(false);

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
    <div className="grid text-center gap-1 p-4 rounded-xl border-secondary border max-w-96">
      <h2 className="text-2xl text-ellipsis">{recipe.name}</h2>
      <span className="w-full flex gap-1">
        <Link
          className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}
          href={`recipes/${recipe.id}`}
        >
          {t("accountPage.viewRecipe")}
        </Link>
        <Link
          className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}
          href={`recipes/${recipe.id}?pdf=true`}
        >
          {t("PDF.title")}
        </Link>
      </span>
      <LoadingButton
        variant="destructive"
        loading={isDeleting}
        onClick={handleDelete}
      >
        {t("accountPage.deleteRecipe")}
      </LoadingButton>
    </div>
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

const SettingsDialog = ({
  username: public_username
}: {
  username: string | null;
}) => {
  const [username, setUsername] = useState(public_username || "");
  const updateUsernameMutation = useUpdatePublicUsername();
  const [preferredUnits, setPreferredUnits] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const units = localStorage.getItem("units");
    if (units) {
      setPreferredUnits(units);
    }
  }, []);

  useEffect(() => {
    if (preferredUnits) localStorage.setItem("units", preferredUnits);
  }, [preferredUnits]);

  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("account.accountSettings")}</DialogTitle>
        </DialogHeader>
        <div className="w-full grid gap-4">
          <label className="w-full flex gap-4 items-center p-1">
            {t("accountPage.theme.title")}
            <ModeToggle />
          </label>
          <label className="w-full p-1">
            {t("accountPage.language.title")}
            <LanguageSwitcher />
          </label>
          <label className="w-full p-1">
            {t("accountPage.units.title")}
            <Select
              value={preferredUnits}
              onValueChange={(val) => setPreferredUnits(val)}
            >
              <SelectTrigger className="full">
                <SelectValue placeholder="Select a Default Unit Standard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">{t("accountPage.units.us")}</SelectItem>
                <SelectItem value="METRIC">
                  {t("accountPage.units.metric")}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="grid gap-2 border border-secondary p-3 rounded-md">
            <label>
              {t("account.updateUsername")}
              <Input
                type="text"
                placeholder="Enter a public username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => updateUsernameMutation.mutate(username)}
            >
              {t("SUBMIT")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
