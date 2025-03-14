"use client";
import { useISpindel } from "@/components/providers/ISpindelProvider";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
function LinkBrew() {
  const { recipes, brews, linkBrew } = useISpindel();
  const { brewId } = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [brew, setBrew] = useState(brews.find((brew) => brew.id === brewId));

  return (
    <div>
      <h2>{t("iSpindelDashboard.brews.link")}</h2>
      <div>
        {recipes.map((rec) => {
          const isCurrentRecipe = rec.id === brew?.recipe_id;
          return (
            <div key={rec.id}>
              <p>{rec.name}</p>
              <Button
                onClick={() => router.push(`/recipes/${rec.id}`)}
                variant={"secondary"}
              >
                {t("accountPage.viewRecipe")}
              </Button>

              <Button
                onClick={() =>
                  linkBrew(rec.id, brewId as string)
                    .then((res) => setBrew(res))
                    .catch((err) => console.error(err))
                }
                disabled={isCurrentRecipe}
              >
                {t("iSpindelDashboard.brews.link")}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LinkBrew;
