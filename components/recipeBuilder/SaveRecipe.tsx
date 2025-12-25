"use client";

import { useMemo, useState } from "react";
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

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // activity email toggle
  const [name, setName] = useState("");

  const {
    data: {
      unitDefaults,
      ingredients,
      fg,
      stabilizers,
      additives,
      notes,
      nutrients
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
      checked
    ]
  );

  const handleCreateRecipe = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast({
        title: t("errorLabel"),
        description: t("nameRequired"),
        variant: "destructive"
      });
      return;
    }

    const body = {
      name: trimmedName,
      dataV2: data, // ✅ send as object; server stores in jsonb
      private: checked,
      activityEmailsEnabled: notify
    };

    createRecipeMutation.mutate(body as any, {
      onSuccess: () => {
        meta.reset();
        setName("");
        toast({ description: t("recipeSuccess") });
        router.push("/account");
      },
      onError: (error: any) => {
        console.error("Error creating recipe:", error?.message ?? error);
        toast({
          title: t("errorLabel"),
          description: t("error.generic"),
          variant: "destructive"
        });
      }
    });
  };

  const isSubmitting = createRecipeMutation.isPending;

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
              {t("SUBMIT")}
            </LoadingButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SaveRecipe;
