"use client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { buttonVariants } from "../ui/button";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../providers/AuthProvider";
import { useParams } from "next/navigation";

export default function DeleteRecipe() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { deleteRecipe } = useAuth();
  const params = useParams();
  const recipeId = params?.id;

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div className="relative group flex flex-col items-center my-2">
            <button className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-destructive text-foreground rounded-full border border-foreground hover:text-destructive hover:bg-foreground transition-colors">
              <Trash />
            </button>
            <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {t("accountPage.deleteRecipe")}
            </span>
          </div>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.subtitle")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (recipeId && typeof recipeId === "string") {
                  deleteRecipe(recipeId);
                  toast({
                    title: "Recipe Deleted",
                    description: `Recipe has been deleted.`,
                  });
                  window.location.href = "/account"; // Redirect back to account page
                }
              }}
            >
              {t("desktop.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
