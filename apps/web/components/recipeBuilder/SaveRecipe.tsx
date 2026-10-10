"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { LoadingButton } from "../ui/LoadingButton";
import Tooltip from "../Tooltips";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth/useAuth";
import { useCreateRecipeMutation } from "@/hooks/reactQuery/useRecipeQuery";
import { useCreateAccountBrew } from "@/hooks/reactQuery/useAccountBrews";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

import { Save } from "lucide-react";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { RecipeData } from "@/types/recipeData";

function SaveRecipe({ bottom }: { bottom?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();

  const createRecipeMutation = useCreateRecipeMutation();
  const createBrewMutation = useCreateAccountBrew();

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // activity email toggle
  const [name, setName] = useState("");
  const [createBrew, setCreateBrew] = useState(false);
  const [brewName, setBrewName] = useState("");
  const [savedRecipeId, setSavedRecipeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  const {
    data: {
      unitDefaults,
      ingredients,
      fg,
      stabilizers,
      additives,
      notes,
      nutrients,
      lossAdjustment
    },
    meta
  } = useRecipe();

  const data: RecipeData = useMemo(
    () => ({
      version: 2,
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      lossAdjustment,
      flags: {
        private: checked
      }
    }),
    [
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      lossAdjustment,
      checked
    ]
  );

  const handleCreateRecipe = async () => {
    if (inFlight.current) return;
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast({
        title: t("errorLabel"),
        description: t("nameRequired"),
        variant: "destructive"
      });
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    const body = {
      name: trimmedName,
      dataV2: data, // ✅ send as object; server stores in jsonb
      private: checked,
      activityEmailsEnabled: notify
    };

    try {
      const recipeId = savedRecipeId ??
        (await createRecipeMutation.mutateAsync(body)).recipe.id;
      setSavedRecipeId(recipeId);
      if (createBrew) {
        try {
          const brew = await createBrewMutation.mutateAsync({
            recipe_id: recipeId,
            name: brewName.trim() || trimmedName
          });
          meta.reset();
          router.push(`/account/brews/${brew.id}`);
        } catch (cause) {
          setError(t("brews.create.savedButFailed"));
          console.error("Error creating brew from saved recipe:", cause);
        }
      } else {
        meta.reset();
        setName("");
        toast({ description: t("recipeSuccess") });
        router.push("/account");
      }
    } catch (cause) {
      console.error("Error creating recipe:", cause);
      setError(t("brews.create.recipeSaveFailed"));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn("joyride-saveRecipe flex flex-col items-center", {
            "w-full": bottom
          })}
        >
          {bottom ? (
            <Button variant="secondary" className="w-full" type="button">
              <Save />
            </Button>
          ) : (
            <UiTooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("recipeForm.submit")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12"
                >
                  <Save />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="whitespace-nowrap">
                {t("recipeForm.submit")}
              </TooltipContent>
            </UiTooltip>
          )}
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recipeForm.title")}</DialogTitle>

          {isLoggedIn ? (
            <div className="space-y-4">
              <label>
                {t("recipeForm.subtitle")}
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="grid">
                {t("private")}
                <Switch checked={checked} onCheckedChange={setChecked} />
              </label>

              {!checked && (
                <label className="grid">
                  <span className="flex items-center">
                    {t("notify")}
                    <Tooltip body={t("tiptext.notify")} />
                  </span>
                  <Switch checked={notify} onCheckedChange={setNotify} />
                </label>
              )}
              <label className="grid gap-2">
                {t("brews.create.withNewRecipe")}
                <Switch checked={createBrew} onCheckedChange={setCreateBrew} disabled={savedRecipeId !== null} />
              </label>
              {createBrew ? (
                <label className="grid gap-2">
                  {t("brews.create.brewName")}
                  <Input
                    value={brewName}
                    onChange={(event) => setBrewName(event.target.value)}
                    placeholder={name || t("brews.newBrew.namePlaceholder")}
                    disabled={isSubmitting}
                  />
                </label>
              ) : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              {savedRecipeId && error ? (
                <Link className="text-sm underline" href={`/recipes/${savedRecipeId}`}>
                  {t("brews.create.openSavedRecipe")}
                </Link>
              ) : null}
            </div>
          ) : (
            <Link
              href={"/login"}
              className="flex items-center justify-center gap-4 px-8 py-2 my-4 text-lg border border-solid rounded-lg bg-background text-foreground hover:bg-foreground hover:border-background hover:text-background sm:gap-8 group"
            >
              {t("recipeForm.login")}
            </Link>
          )}
        </DialogHeader>

        {isLoggedIn && (
          <DialogFooter>
            <LoadingButton
              onClick={handleCreateRecipe}
              loading={isSubmitting}
              variant="secondary"
            >
              {savedRecipeId ? t("brews.create.retryBrew") : t("SUBMIT")}
            </LoadingButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SaveRecipe;
