"use client";

import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";

import { useBrewById, useLinkBrewToRecipe } from "@/hooks/useBrews";
import { useAccountInfo } from "@/hooks/useAccountInfo";

function LinkBrew() {
  const { t } = useTranslation();
  const router = useRouter();

  const params = useParams();
  const brewId = params.brewId as string;

  const {
    brew,
    isLoading: brewsLoading,
    isError: brewsError
  } = useBrewById(brewId);

  const {
    data: accountInfo,
    isLoading: accountLoading,
    isError: accountError
  } = useAccountInfo();

  const recipes = accountInfo?.recipes ?? [];

  const linkMutation = useLinkBrewToRecipe();

  const isLoading = brewsLoading || accountLoading;
  const isError = brewsError || accountError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("loading", "Loading…")}</p>
      </div>
    );
  }

  if (isError || !brew) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>
          {t(
            "iSpindelDashboard.brews.linkError",
            "Unable to load brew or recipes."
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl mb-4">{t("iSpindelDashboard.brews.link")}</h2>

      <div className="flex justify-evenly gap-4 flex-wrap">
        {recipes.map((rec: any) => {
          const isCurrentRecipe = rec.id === brew.recipe_id;

          return (
            <div key={rec.id} className="text-center border rounded-lg p-3">
              <p className="font-medium mb-2">{rec.name}</p>

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => router.push(`/recipes/${rec.id}`)}
                  variant="secondary"
                >
                  {t("accountPage.viewRecipe")}
                </Button>

                <Button
                  disabled={isCurrentRecipe || linkMutation.isPending}
                  onClick={async () => {
                    try {
                      await linkMutation.mutateAsync({
                        brewId,
                        recipeId: rec.id
                      });
                      router.replace("/account/hydrometer/brews");
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  {t("iSpindelDashboard.brews.link")}
                </Button>
              </div>

              {isCurrentRecipe && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "iSpindelDashboard.brews.currentRecipe",
                    "This recipe is already linked to this brew."
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LinkBrew;
