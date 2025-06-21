"use client";
import { useAuth } from "@/components/providers/AuthProvider";
import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import Loading from "@/components/loading";
import { Settings, LogOut, LucideX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModeToggle } from "@/components/ui/mode-toggle";
import LanguageSwitcher from "@/components/ui/language-switcher";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { cn } from "@/lib/utils";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";

type Recipe = {
  id: number;
  user_id: number;
  name: string;
  recipeData: string;
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  nuteInfo: string | null;
  primaryNotes: [string, string][];
  secondaryNotes: [string, string][];
};

type UserData = {
  user: {
    id: number;
    google_id: string | null;
    hydro_token: string | null;
    public_username: string | null;
    email: string;
  };
  recipes: Recipe[];
};

function Account() {
  const { t } = useTranslation();
  const { fetchAuthenticatedData, logout, deleteRecipe, isLoggedIn } =
    useAuth();
  const [data, setData] = useState<UserData | null>(null);
  const [isUsernameDialogOpen, setUsernameDialogOpen] = useState(false);

  const searchKey = "name";
  const pageSize = 5;
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
    end,
  } = useFuzzySearch({
    data: data?.recipes ?? [],
    pageSize,
    searchKey,
  });

  const deleteIndividualRecipe = async (id: number) => {
    try {
      await deleteRecipe(id.toString());
      setData((prev) =>
        prev
          ? {
              ...prev,
              recipes: prev.recipes.filter((r) => r.id !== id),
            }
          : null
      );
    } catch (err) {
      console.error("Error deleting recipe:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchAuthenticatedData("/api/auth/account-info")
        .then((data) => {
          setData(data);
          setUsernameDialogOpen(data.user.public_username === null);
        })
        .catch((error) => console.error(error));
    }
  }, []);

  if (!data || !filteredData) return <Loading />;

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
        {searchKey && filteredData.length > 0 && (
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
        )}
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
            <p className="mr-auto">{t("account.noRecipes")}</p>
          )}
        </div>
      </div>
      {filteredData.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
          <span>
            {t("pagination.showing", {
              start: start + 1,
              end: Math.min(end, filteredData.length),
              total: filteredData.length,
            })}
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
  deleteRecipe,
}: {
  recipe: Recipe;
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
  closeDialog,
}: {
  isDialogOpen: boolean;
  closeDialog: () => void;
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const { updatePublicUsername } = useAuth();
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
              updatePublicUsername(username);
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
  username: public_username,
}: {
  username: string | null;
}) => {
  const [username, setUsername] = useState(public_username || "");
  const { updatePublicUsername } = useAuth();
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
              onClick={() => updatePublicUsername(username)}
            >
              {t("SUBMIT")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
