"use client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

import { Save } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";
import { Button } from "../ui/button";
import TooltipHelper from "../Tooltips";
import { useCreateRecipeMutation } from "@/hooks/reactQuery/useRecipeQuery";
import { useRecipe } from "@/components/providers/RecipeProvider";
import type { RecipeData } from "@/types/recipeData";
import { useAuth } from "@/hooks/auth/useAuth";

function SaveRecipeCopy() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const createRecipeMutation = useCreateRecipeMutation();

  const {
    data: {
      unitDefaults,
      ingredients,
      fg,
      stabilizers,
      additives,
      notes,
      nutrients
    }
  } = useRecipe();

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // activity emails
  const [recipeName, setRecipeName] = useState("");

  // match local-storage + save recipe v2 payload shape
  const dataV2: RecipeData = useMemo(
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

  const createRecipe = async () => {
    const trimmedName = recipeName.trim();

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
      dataV2, // jsonb
      private: checked,
      activityEmailsEnabled: notify
    };

    try {
      await createRecipeMutation.mutateAsync(body as any);

      toast({ description: t("recipeSuccess") });
      router.push("/account");
    } catch (error: any) {
      console.error("Error creating recipe:", error?.message ?? error);
      toast({
        title: t("error"),
        description: t("error.generic"),
        variant: "destructive"
      });
    }
  };

  const { isLoggedIn } = useAuth();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={"secondary"} className="ml-auto max-w-max">
          <Save />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("saveCopy")}</DialogTitle>

          {isLoggedIn ? (
            <div className="space-y-4">
              <label>
                {t("recipeForm.subtitle")}
                <Input
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                />
              </label>

              <label className="grid">
                {t("private")}
                <Switch checked={checked} onCheckedChange={setChecked} />
              </label>

              {!checked && (
                <label className="grid">
                  <span className="flex items-center gap-1">
                    {t("notify")}
                    <TooltipHelper body={t("tiptext.notify")} />
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
              onClick={createRecipe}
              loading={createRecipeMutation.isPending}
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

export default SaveRecipeCopy;
