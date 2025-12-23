"use client";

import SearchableInput from "../ui/SearchableInput";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { isValidNumber } from "@/lib/utils/validateInput";
import lodash from "lodash";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Trash } from "lucide-react";
import { Separator } from "../ui/separator";
import DragList from "../ui/DragList";

import type { Additive } from "@/types/recipeDataTypes";
import type { AdditiveLine as AdditiveLine } from "@/types/recipeData";
import { useRecipe } from "../providers/RecipeProvider";

const weightUnits = [
  { value: "g", label: "G" },
  { value: "mg", label: "MG" },
  { value: "kg", label: "KG" },
  { value: "oz", label: "OZ" },
  { value: "lbs", label: "LBS" }
];

const volumeUnits = [
  { value: "ml", label: "ML" },
  { value: "liters", label: "LIT" },
  { value: "fl oz", label: "FLOZ" },
  { value: "quarts", label: "QUARTS" },
  { value: "gal", label: "GALS" },
  { value: "tsp", label: "TSP" },
  { value: "tbsp", label: "TBSP" }
];

const countUnits = [{ value: "units", label: "UNITS" }];
export default function Additives() {
  const { t } = useTranslation();

  const {
    data: { additives },
    additives: additivesApi,
    catalog: { additiveList, loadingAdditives }
  } = useRecipe();

  return (
    <div className="py-6">
      <div className="grid gap-4">
        {loadingAdditives ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : additives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "additives.empty",
              "Add some additives to continue building your recipe."
            )}
          </p>
        ) : (
          <DragList
            items={additives}
            setItems={additivesApi.reorder}
            getId={(a) => a.lineId}
            renderItem={(add) => (
              <AdditiveLine
                additiveList={additiveList}
                add={add}
                changeAdditive={(value) =>
                  additivesApi.setName(add.lineId, value)
                }
                changeUnit={(unit) => additivesApi.setUnit(add.lineId, unit)}
                changeAmount={(amount) =>
                  additivesApi.setAmount(add.lineId, amount)
                }
                remove={() => additivesApi.remove(add.lineId)}
              />
            )}
          />
        )}

        <Button
          onClick={additivesApi.add}
          variant="secondary"
          disabled={additives.length >= 10}
          className="w-full sm:w-auto"
        >
          {t("additives.addNew")}
        </Button>
      </div>
    </div>
  );
}

const AdditiveLine = ({
  additiveList,
  add,
  changeAdditive,
  changeUnit,
  changeAmount,
  remove
}: {
  additiveList: Additive[];
  add: AdditiveLine;
  changeAdditive: (val: string) => void;
  changeUnit: (val: string) => void;
  changeAmount: (val: string) => void;
  remove: () => void;
}) => {
  const { t } = useTranslation();

  const handleAdditiveSelect = (selected: Additive) => {
    changeAdditive(selected.name);
  };

  return (
    <div className="joyride-additiveLine grid gap-3 py-4 relative">
      <Button
        onClick={remove}
        variant="destructive"
        size="sm"
        className="absolute top-0 right-0"
      >
        <Trash className="h-4 w-4" />
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-12">
        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("name")}</span>
          <SearchableInput
            items={additiveList}
            query={add.name}
            setQuery={changeAdditive}
            keyName="name"
            onSelect={handleAdditiveSelect}
            renderItem={(item) => t(lodash.camelCase(item.name))}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("PDF.addAmount")}</span>

          <InputGroup className="h-12">
            <InputGroupInput
              value={add.amount}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) changeAmount(e.target.value);
              }}
              inputMode="decimal"
              type="text"
              onFocus={(e) => e.target.select()}
              className="h-full text-lg"
            />

            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />

              <Select value={add.unit} onValueChange={changeUnit}>
                <SelectTrigger className="p-2 border-none mr-2 w-16">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {weightUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {t(unit.label)}
                    </SelectItem>
                  ))}

                  <SelectSeparator />

                  {volumeUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {t(unit.label)}
                    </SelectItem>
                  ))}

                  <SelectSeparator />

                  {countUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {t(unit.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </label>
      </div>
    </div>
  );
};
