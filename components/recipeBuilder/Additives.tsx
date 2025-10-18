import SearchableInput from "../ui/SearchableInput";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { Additive, AdditiveType, Recipe } from "@/types/recipeDataTypes";
import { Input } from "../ui/input";
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
    <div>
      <span>
        {additives.length === 0 ? (
          "Add Some Ingredients to Continue Building your Recipe."
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
      </span>
      <Button
        onClick={addAdditive}
        variant={"secondary"}
        disabled={additives.length >= 10}
        className="w-full"
      >
        {t("additives.addNew")}
      </Button>
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
    <div className="joyride-additiveLine grid sm:grid-cols-6 grid-cols-3 gap-2 py-4 items-center justify-center">
      <label className="sm:col-span-2 col-span-full">
        {t("name")}
        <SearchableInput
          items={additiveList}
          query={add.name}
          setQuery={(val) => changeAdditive(val)}
          keyName="name"
          onSelect={handleAdditiveSelect}
          renderItem={(item) => {
            return t(lodash.camelCase(item.name));
          }}
        />
      </label>
      <label className="col-span-2">
        {t("PDF.addAmount")}
        <Input
          value={add.amount}
          onChange={(e) => {
            if (isValidNumber(e.target.value)) changeAmount(e.target.value);
          }}
          inputMode="decimal"
          onFocus={(e) => e.target.select()}
        />
      </label>
      <label>
        {t("UNITS")}
        <Select value={add.unit} onValueChange={changeUnit}>
          <SelectTrigger>
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
      </label>

      <Button onClick={remove} variant={"destructive"} className="mt-auto">
        Remove
      </Button>
    </div>
  );
};
