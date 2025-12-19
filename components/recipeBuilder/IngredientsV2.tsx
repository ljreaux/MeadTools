import { IngredientCatalogItem, IngredientLineV2 } from "@/types/recipeDataV2";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import SearchableInput from "../ui/SearchableInput";
import { useTranslation } from "react-i18next";
import InputWithUnits from "../nutrientCalc/InputWithUnits";
import Tooltip from "../Tooltips";
import lodash from "lodash";
import { Separator } from "../ui/separator";
import { Trash } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import SortableItem from "../ui/SortableItem";
import DragListV2 from "../ui/DragListV2";

export default function IngredientsV2() {
  const { t } = useTranslation();

  const {
    data: { ingredients, unitDefaults },
    ingredient,
    catalog: { ingredientList, loadingIngredients }
  } = useRecipeV2();

  if (loadingIngredients) {
    return <IngredientsSkeleton />;
  }

  return (
    <div className="py-6">
      <div className="grid gap-4">
        <h3 className="text-base font-semibold">
          {t("recipeBuilder.labels.ingredients")}
        </h3>

        <div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "recipeBuilder.emptyIngredients",
                "Add some ingredients to continue building your recipe."
              )}
            </p>
          ) : (
            <DragListV2
              items={ingredients}
              setItems={ingredient.reorder}
              getId={(ing) => ing.lineId}
              renderItem={(ing, i) => (
                <IngredientLine
                  ing={ing}
                  ingredientList={ingredientList}
                  unitDefaults={unitDefaults}
                  deleteFn={() => ingredient.remove(ing.lineId)}
                  changeIng={(val) => ingredient.setName(ing.lineId, val)}
                  selectCatalog={(item) =>
                    ingredient.selectCatalog(ing.lineId, item)
                  }
                  updateWeight={(val) =>
                    ingredient.setWeightValue(ing.lineId, val)
                  }
                  updateVolume={(val) =>
                    ingredient.setVolumeValue(ing.lineId, val)
                  }
                  updateBrix={(val) => ingredient.setBrix(ing.lineId, val)}
                  toggleChecked={(val) =>
                    ingredient.setSecondary(ing.lineId, val)
                  }
                  // fillToNearest: leave out for now until we rebuild it in V2
                  index={i}
                />
              )}
            />
          )}
        </div>

        <Button
          onClick={ingredient.add}
          variant="secondary"
          disabled={ingredients.length >= 10}
          className="w-full sm:w-auto"
        >
          {t("recipeBuilder.addNew")}
        </Button>
      </div>

      <Separator className="mt-4" />
    </div>
  );
}

const IngredientLine = ({
  ing,
  ingredientList,
  unitDefaults,
  deleteFn,
  changeIng,
  selectCatalog,
  updateWeight,
  updateVolume,
  updateBrix,
  toggleChecked,
  index
}: {
  ing: IngredientLineV2;
  deleteFn: () => void;
  changeIng: (val: string) => void;
  selectCatalog: (item: IngredientCatalogItem) => void;
  updateWeight: (val: string) => void;
  updateVolume: (val: string) => void;
  updateBrix: (val: string) => void;
  toggleChecked: (val: boolean) => void;
  ingredientList: IngredientCatalogItem[];
  unitDefaults: { weight: string; volume: string };
  index: number;
}) => {
  const { t } = useTranslation();

  return (
    <div className={`joyride-ingredient-${index + 1} grid gap-1 py-2`}>
      <div className="flex justify-end mb-1">
        <Button onClick={deleteFn} variant="destructive" size="sm">
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 1: Ingredient + Brix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="grid gap-1">
          <span className="flex items-center gap-1 text-sm font-medium">
            {t("ingredient")} <Tooltip body={t("ingredientTooltip")} />
          </span>
          <div className="w-full">
            <SearchableInput
              items={ingredientList}
              query={ing.name}
              setQuery={changeIng}
              keyName="name"
              onSelect={selectCatalog}
              renderItem={(item) => t(lodash.camelCase(item.name))}
            />
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("BRIX")}</span>
          <div className="w-full">
            <InputWithUnits
              value={ing.brix}
              handleChange={(e) => updateBrix(e.target.value)}
              text={t("BRIX")}
            />
          </div>
        </label>
      </div>

      {/* Row 2: Weight + Volume (still 1 input each, like you want) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            {t("recipeBuilder.labels.weight")}
          </span>
          <div className="w-full">
            <InputWithUnits
              value={ing.amounts.weight.value}
              handleChange={(e) => updateWeight(e.target.value)}
              text={ing.amounts.weight.unit ?? unitDefaults.weight}
            />
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">
            {t("recipeBuilder.labels.volume")}
          </span>
          <div className="w-full">
            <InputWithUnits
              value={ing.amounts.volume.value}
              handleChange={(e) => updateVolume(e.target.value)}
              text={ing.amounts.volume.unit ?? unitDefaults.volume}
            />
          </div>
        </label>
      </div>

      {/* Row 3: Secondary (keep) */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mt-3">
        <label
          className={`joyride-secondary-${index + 1} inline-flex items-center gap-2 text-sm`}
        >
          <span>{t("recipeBuilder.labels.secondary")}</span>
          <Switch checked={ing.secondary} onCheckedChange={toggleChecked} />
        </label>

        {/* Fill-to-next: skip until V2 has “total volume” logic again */}
      </div>
    </div>
  );
};

/* SKELETONS (unchanged) */

const IngredientsSkeleton = () => {
  const { t } = useTranslation();

  return (
    <div className="py-6">
      <div className="grid gap-4">
        <h3 className="text-base font-semibold">
          {t("recipeBuilder.labels.ingredients")}
        </h3>

        <div>
          {Array.from({ length: 2 }).map((_, i) => (
            <SortableIngredientSkeleton key={i} id={`skeleton-${i}`} />
          ))}
        </div>

        <Skeleton className="h-10 w-full rounded-lg col-span-full" />
      </div>

      <Separator className="mt-4" />
    </div>
  );
};

const SortableIngredientSkeleton = ({ id }: { id: string }) => {
  return (
    <SortableItem id={id}>
      <IngredientLineSkeleton />
    </SortableItem>
  );
};

const IngredientLineSkeleton = () => {
  return (
    <div className="grid gap-1 py-2">
      <div className="flex justify-end mb-1">
        <Skeleton className="w-10 h-9 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-1">
          <Skeleton className="h-5 w-1/2 mb-0.5" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        <div className="grid gap-1">
          <Skeleton className="h-5 w-1/3 mb-0.5" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <div className="grid gap-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        <div className="grid gap-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mt-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    </div>
  );
};
