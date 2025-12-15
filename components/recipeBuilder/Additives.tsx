import SearchableInput from "../ui/SearchableInput";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { Additive, AdditiveType, Recipe } from "@/types/recipeDataTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { isValidNumber } from "@/lib/utils/validateInput";
import DragList from "../ui/DragList";
import lodash from "lodash";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Trash } from "lucide-react";
import { Separator } from "../ui/separator";

const units = [
  { value: "g", label: "G" },
  { value: "mg", label: "MG" },
  { value: "kg", label: "KG" },
  { value: "oz", label: "OZ" },
  { value: "lbs", label: "LBS" },
  { value: "ml", label: "ML" },
  { value: "liters", label: "LIT" },
  { value: "fl oz", label: "FLOZ" },
  { value: "quarts", label: "QUARTS" },
  { value: "gal", label: "GALS" },
  { value: "tsp", label: "TSP" },
  { value: "tbsp", label: "TBSP" },
  { value: "units", label: "UNITS" }
];

function Additives({ useRecipe }: { useRecipe: () => Recipe }) {
  const { t } = useTranslation();
  const {
    additives,
    changeAdditive,
    changeAdditiveUnits,
    changeAdditiveAmount,
    addAdditive,
    removeAdditive,
    additiveList,
    updateAdditives
  } = useRecipe();

  return (
    <div className="py-6">
      <div className="grid gap-4">
        {additives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "additives.empty",
              "Add some additives to continue building your recipe."
            )}
          </p>
        ) : (
          <DragList
            items={additives}
            setItems={updateAdditives}
            renderItem={(add) => {
              const id = additives.find((item) => item.id === add.id)?.id || "";
              return (
                <AdditiveLine
                  additiveList={additiveList}
                  add={add}
                  changeAdditive={(value) => {
                    changeAdditive(id, value);
                  }}
                  changeUnit={(unit) => {
                    changeAdditiveUnits(id, unit);
                  }}
                  changeAmount={(amount) => {
                    changeAdditiveAmount(id, amount);
                  }}
                  remove={() => {
                    removeAdditive(id);
                  }}
                />
              );
            }}
          />
        )}

        <Button
          onClick={addAdditive}
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

export default Additives;

const AdditiveLine = ({
  additiveList,
  add,
  changeAdditive,
  changeUnit,
  changeAmount,
  remove
}: {
  additiveList: Additive[];
  add: AdditiveType;
  changeAdditive: (val: string) => void;
  changeUnit: (val: string) => void;
  changeAmount: (val: string) => void;
  remove: () => void;
}) => {
  const { t } = useTranslation();

  const handleAdditiveSelect = (selectedIngredient: Additive) => {
    changeAdditive(selectedIngredient.name);
  };

  return (
    <div className="joyride-additiveLine grid gap-3 py-4 relative">
      {/* Delete button (top-right but not shifting layout) */}
      <Button
        onClick={remove}
        variant="destructive"
        size="sm"
        className="absolute top-0 right-0"
      >
        <Trash className="h-4 w-4" />
      </Button>

      {/* Row: Name + Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-12">
        {/* NAME */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("name")}</span>
          <SearchableInput
            items={additiveList}
            query={add.name}
            setQuery={(val) => changeAdditive(val)}
            keyName="name"
            onSelect={handleAdditiveSelect}
            renderItem={(item) => t(lodash.camelCase(item.name))}
          />
        </label>

        {/* AMOUNT + UNITS */}
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
                  {units.map((unit) => (
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
