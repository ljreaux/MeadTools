"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import RecipeCalculatorSideBar from "../recipeBuilder/Sidebar";
import SaveChanges from "./SaveChanges";
import SaveNew from "./SaveNew";
import DeleteRecipe from "./DeleteRecipe";
import { useEffect, useMemo, useRef, useState } from "react";
import CommentsSection from "./comments/CommentsSection";
import RecipeCardHeader from "./RecipeCardHeader";
import Units from "../recipeBuilder/Units";
import Ingredients from "../recipeBuilder/Ingredients";
import IngredientResults from "../recipeBuilder/Results";
import ScaleRecipeForm from "../recipeBuilder/ScaleRecipeForm";
import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";
import Stabilizers from "../recipeBuilder/Stabilizers";
import Additives from "../recipeBuilder/Additives";
import Notes from "../recipeBuilder/Notes";
import RecipePdf from "../recipeBuilder/RecipePdf";
import useRecipeVersionGate from "@/hooks/useRecipeVersionGate";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";
import { NutrientProvider } from "../providers/NutrientProvider";
import { useRecipe } from "../providers/RecipeProvider";
import { useBanner } from "../ui/banner";
import { useSaveRecipe } from "@/hooks/useSaveRecipe";
import { useAccountBrews } from "@/hooks/reactQuery/useAccountBrews";
import { Skeleton } from "../ui/skeleton";
import { formatSgDisplay } from "@/lib/utils/gravityFormatting";

const buildCardConfig = ({
  recipeId,
  recipeName,
  publicUsername
}: {
  recipeId: number;
  recipeName: string;
  publicUsername?: string | null;
}) => [
  {
    key: "card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <Units key="units" />,
      <Ingredients key="ingredients" />,
      <IngredientResults key="ingredientResults" />,
      <ScaleRecipeForm key="scaleIngredientsForm" />
    ]
  },
  {
    key: "card 2",
    heading: "nutesHeading",
    components: [
      <VolumeInputs key="volumeInputs" mode="embedded" />,
      <YeastDetails key="yeastDetails" />
    ]
  },
  {
    key: "card 3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" />,
      <Results key="results" />,
      <AdditionalDetails key="additionalDetails" />
    ]
  },
  {
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<Stabilizers key="stabilizers" />]
  },
  {
    key: "card 5",
    heading: "additivesHeading",
    components: [<Additives key="additives" />]
  },
  {
    key: "card 6",
    heading: "notes.title",
    components: [<Notes key="notes" />]
  },
  {
    key: "card 7",
    heading: "PDF.title",
    components: [
      <RecipePdf
        key="pdf"
        title={recipeName}
        publicUsername={publicUsername ?? ""}
      />
    ]
  },
  {
    key: "card 8",
    heading: "recipes.connectedBrews.title",
    components: [<ConnectedBrews key="connectedBrews" recipeId={recipeId} />]
  }
];

function OwnerRecipe({
  pdfRedirect,
  recipe
}: {
  pdfRedirect: boolean;
  recipe: RecipeWithParsedFields;
}) {
  useRecipeVersionGate(recipe);
  const [isPrivate, setIsPrivate] = useState(recipe.private ?? false);
  const [notify, setNotify] = useState(recipe.emailNotifications ?? false);
  const [nameEditable, setNameEditable] = useState(false);
  const [recipeName, setRecipeName] = useState(recipe.name);
  const { t } = useTranslation();

  const cardConfig = buildCardConfig({
    recipeId: recipe.id,
    recipeName,
    publicUsername: recipe.public_username
  });

  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <RecipeCardHeader
        heading={heading}
        tooltip={tooltip}
        recipe={recipe}
        recipeNameProps={{
          recipeName,
          setRecipeName: (v) => {
            setRecipeName(v);
            markDirty();
          }
        }}
        nameEditable={nameEditable}
        setNameEditable={setNameEditable}
        isPrivate={isPrivate}
        setIsPrivate={(v) => {
          setIsPrivate(v);
          markDirty();
        }}
        notify={notify}
        setNotify={(v) => {
          setNotify(v);
          markDirty();
        }}
      />

      {components}

      {!recipe.private && <CommentsSection recipeId={recipe.id} />}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients, isDirty, markDirty }
  } = useRecipe();

  useEffect(() => {
    if (pdfRedirect) {
      const pdfCardIndex = cardConfig.findIndex((card) => card.key === "card 7");
      goTo(pdfCardIndex === -1 ? cards.length - 1 : pdfCardIndex);
    }
  }, [pdfRedirect]);

  const { showBanner, requestDismiss } = useBanner();
  const bannerIdRef = useRef<string | null>(null);

  const { save, isSaving } = useSaveRecipe({
    name: recipeName,
    privateRecipe: isPrivate,
    emailNotifications: notify
  });

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (isDirty) {
      // already showing
      if (bannerIdRef.current) return;

      const id = showBanner({
        variant: "warning",
        dismissible: true,
        duration: 0,
        title: t("changesBanner.title"),
        description: t("changesBanner.description"),
        action: {
          label: isSaving ? t("saving") : t("changesForm.submit"),
          onClick: () => saveRef.current()
        }
      });

      bannerIdRef.current = id;
      return;
    }

    // isDirty === false -> dismiss if present
    if (bannerIdRef.current) {
      requestDismiss(bannerIdRef.current);
      bannerIdRef.current = null;
    }
  }, [isDirty, isSaving, t, showBanner, requestDismiss]);

  return (
    <NutrientProvider
      mode="controlled"
      value={nutrientValueForRecipe}
      onChange={setNutrients}
    >
      <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
        <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
          <div className="py-2">
            <SaveChanges
              privateRecipe={isPrivate}
              emailNotifications={notify}
              name={recipeName}
            />
            <SaveNew />
            <DeleteRecipe />
          </div>
        </RecipeCalculatorSideBar>
        {card}

        <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
          {currentStepIndex === 0 || (
            <Button variant="secondary" onClick={back} className="w-full">
              {t("buttonLabels.back")}
            </Button>
          )}

          {currentStepIndex === cards.length - 1 ? (
            <SaveChanges privateRecipe={isPrivate} name={recipeName} bottom />
          ) : (
            <Button variant="secondary" onClick={next} className="w-full">
              {t("buttonLabels.next")}
            </Button>
          )}
        </div>
      </div>
    </NutrientProvider>
  );
}

function ConnectedBrews({ recipeId }: { recipeId: number }) {
  const { t, i18n } = useTranslation();
  const { data: brews = [], isLoading, isError } = useAccountBrews();

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: "short"
      }),
    [i18n.resolvedLanguage]
  );

  const connectedBrews = useMemo(
    () =>
      brews
        .filter((brew) => brew.recipe_id === recipeId)
        .sort((a, b) => {
          if (!a.end_date && b.end_date) return -1;
          if (a.end_date && !b.end_date) return 1;
          return (
            new Date(b.start_date).getTime() -
            new Date(a.start_date).getTime()
          );
        }),
    [brews, recipeId]
  );

  const formatDate = (date?: string | null) =>
    date ? formatter.format(new Date(date)) : "—";

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {t(
            "recipes.connectedBrews.description",
            "Brews created from this recipe appear here."
          )}
        </p>
        <p className="text-sm font-medium">
          {t("recipes.connectedBrews.count", {
            count: connectedBrews.length,
            defaultValue: "Linked brews: {{count}}"
          })}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          {t("brews.error.loadList", "Something went wrong loading brews.")}
        </p>
      ) : connectedBrews.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t(
            "recipes.connectedBrews.empty",
            "No brews are linked to this recipe yet."
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {connectedBrews.map((brew) => (
            <article
              key={brew.id}
              className="flex flex-col gap-4 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    {brew.name || brew.id}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(`brewStage.${brew.stage}`, brew.stage)}
                  </p>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("brews.startDate", "Start Date")}
                    </dt>
                    <dd>{formatDate(brew.start_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("brews.endDate", "End Date")}
                    </dt>
                    <dd>
                      {brew.end_date ? formatDate(brew.end_date) : t("ongoing")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("brews.secondary.latestGravity", "Latest gravity")}
                    </dt>
                    <dd>{formatSgDisplay(brew.latest_gravity, i18n.resolvedLanguage)}</dd>
                  </div>
                </dl>
              </div>

              <Button asChild variant="secondary" className="shrink-0">
                <Link
                  href={`/account/brews/${brew.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("recipes.connectedBrews.openBrew", "Open brew")}
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OwnerRecipe;
