"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

import { FilePlus } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";
import TooltipHelper from "../Tooltips";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

import { useCreateRecipeMutation } from "@/hooks/reactQuery/useRecipeQuery";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import type { RecipeDataV2 } from "@/types/recipeDataV2";

function SaveNew() {
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
  } = useRecipeV2();

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // activity emails
  const [recipeName, setRecipeName] = useState("");

  // ✅ match local-storage + save recipe v2 payload shape
  const dataV2: RecipeDataV2 = useMemo(
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
        title: "Error",
        description: "Recipe name is required.",
        variant: "destructive"
      });
      return;
    }

    const body = {
      name: trimmedName,
      dataV2, // ✅ jsonb
      private: checked,
      activityEmailsEnabled: notify
    };

    try {
      await createRecipeMutation.mutateAsync(body as any);

      toast({ description: "Recipe created successfully." });
      router.push("/account");
    } catch (error: any) {
      console.error("Error creating recipe:", error?.message ?? error);
      toast({
        title: "Error",
        description: "There was an error creating your recipe",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="relative flex flex-col items-center my-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t("changesForm.saveAs")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12"
              >
                <FilePlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="whitespace-nowrap">
              {t("changesForm.saveAs")}
            </TooltipContent>
          </Tooltip>
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changesForm.saveAs")}</DialogTitle>

          <div className="space-y-4">
            <label>
              {t("changesForm.subtitle")}
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
        </DialogHeader>

        <DialogFooter>
          <LoadingButton
            onClick={createRecipe}
            loading={createRecipeMutation.isPending}
            variant="secondary"
          >
            {t("SUBMIT")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveNew;
