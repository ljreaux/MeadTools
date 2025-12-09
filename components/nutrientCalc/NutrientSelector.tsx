import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../ui/dialog";
import { isValidNumber } from "@/lib/utils/validateInput";
import { cn } from "@/lib/utils";
import { Switch } from "../ui/switch";
import { NutrientType } from "@/types/nutrientTypes";

function NutrientSelector({
  useNutrients
}: {
  useNutrients: () => NutrientType;
}) {
  const { t } = useTranslation();
  const {
    selected,
    setSelectedNutrients,
    inputs,
    otherYanContribution,
    otherNutrientName,
    maxGpl,
    editMaxGpl
  } = useNutrients();
  // Handle the change of selected nutrients
  const handleNutrientChange = (nutrient: string) => {
    const prevSelected = selected?.selectedNutrients || [];

    if (prevSelected?.includes(nutrient)) {
      // If the nutrient is already selected, remove it
      setSelectedNutrients(prevSelected.filter((item) => item !== nutrient));
    } else {
      // If the nutrient is not selected, add it
      setSelectedNutrients([...prevSelected, nutrient]);
    }
  };

  return (
    <div className="border-b border-muted-foreground py-6">
      <h3 className="flex items-center gap-1">
        {t("selectNutes")}
        <Tooltip
          body={t("tipText.preferredSchedule")}
          link="https://wiki.meadtools.com/en/process/nutrient_schedules"
        />
      </h3>
      <div className="joyride-nutrientSwitches grid sm:grid-cols-2">
        {[
          { value: "Fermaid O", label: "nutrients.fermO" },
          { value: "Fermaid K", label: "nutrients.fermK" },
          { value: "DAP", label: "nutrients.dap" }
        ].map((label, i) => (
          <LabeledCheckbox
            key={label.value + i}
            label={label}
            index={i}
            useNutrients={useNutrients}
          />
        ))}
        <label className="flex items-center gap-2">
          <Switch
            checked={selected.selectedNutrients?.includes("Other")}
            onCheckedChange={() => handleNutrientChange("Other")}
          />
          {t("other.label")}
        </label>
        {selected.selectedNutrients?.includes("Other") && (
          <div className="grid grid-cols-2 gap-2 w-full col-span-2 py-6">
            <h3 className="col-span-2"> Other Nutrient Details</h3>
            <label className="space-y-2 col-span-2">
              Name
              <Input {...otherNutrientName} />
            </label>
            <label className="space-y-2">
              YAN Contribution
              <div className="relative">
                <Input {...otherYanContribution} />
                <p className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground">
                  PPM YAN
                </p>
              </div>
            </label>
            <label className="space-y-2">
              Max g/L
              <div className="relative">
                <Input
                  value={maxGpl[3]}
                  onChange={(e) => editMaxGpl(3, e.target.value)}
                />
                <p className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground">
                  g/L
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
      <div>
        <label className="joyride-numOfAdditions grid gap-1">
          <span className="flex items-center gap-1">
            {t("numberOfAdditions")}
            <Tooltip body={t("tipText.numberOfAdditions")} />
          </span>
          <Select {...inputs.numberOfAdditions}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  );
}

export default NutrientSelector;

const SettingsDialog = ({
  maxGpl,
  yanContribution,
  providedYan,
  adjustAllowed,
  setAdjustAllowed,
  tutorialClassFlag
}: {
  maxGpl: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  yanContribution: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  providedYan: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  adjustAllowed: boolean;
  setAdjustAllowed: (value: boolean) => void;
  tutorialClassFlag?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger
        className={tutorialClassFlag ? "joyride-nutrientSettings" : ""}
      >
        <Settings />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Nutrient Settings</DialogTitle>
          <DialogDescription>
            <div className="p-2">
              <label className="space-y-2">
                YAN Contribution
                <div className="relative">
                  <Input
                    {...yanContribution}
                    onFocus={(e) => e.target.select()}
                    inputMode="decimal"
                  />
                  <p className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground">
                    PPM YAN
                  </p>
                </div>
              </label>
            </div>
            <div className="p-2">
              <label className="space-y-2">
                Max g/L
                <div className="relative">
                  <Input
                    {...maxGpl}
                    onFocus={(e) => e.target.select()}
                    inputMode="decimal"
                  />
                  <span className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground">
                    g/L
                  </span>
                </div>
              </label>
            </div>
            <div
              className={cn(
                adjustAllowed && "bg-destructive",
                "flex gap-2 items-center p-2 rounded-md transition-colors"
              )}
            >
              <label className="space-y-2 w-full">
                Provided YAN
                <div className="relative">
                  <Input
                    {...providedYan}
                    onFocus={(e) => e.target.select()}
                    inputMode="decimal"
                    disabled={!adjustAllowed}
                  />
                  <p className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground">
                    PPM YAN
                  </p>
                </div>
              </label>
              <label className="flex gap-1">
                Adjust Value
                <Switch
                  checked={adjustAllowed}
                  onCheckedChange={setAdjustAllowed}
                />
                <Tooltip body={t("tipText.adjustYanValue")} />
              </label>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

const LabeledCheckbox = ({
  index,
  label,
  useNutrients
}: {
  useNutrients: () => NutrientType;
  index: number;
  label: { value: string; label: string };
}) => {
  const { t } = useTranslation();
  const {
    selected,
    maxGpl,
    yanContributions,
    editMaxGpl,
    editYanContribution,
    setSelectedNutrients,
    providedYan,
    updateProvidedYan,
    adjustAllowed,
    setAdjustAllowed
  } = useNutrients();
  const handleNutrientChange = (nutrient: string) => {
    const prevSelected = selected?.selectedNutrients || [];

    if (prevSelected?.includes(nutrient)) {
      // If the nutrient is already selected, remove it
      setSelectedNutrients(prevSelected?.filter((item) => item !== nutrient));
    } else {
      // If the nutrient is not selected, add it
      setSelectedNutrients([...prevSelected, nutrient]);
    }
  };

  return (
    <label className="flex items-center gap-2">
      <Switch
        checked={selected.selectedNutrients?.includes(label.value)}
        onCheckedChange={() => handleNutrientChange(label.value)}
      />
      {t(label.label)}
      <SettingsDialog
        maxGpl={{
          value: maxGpl[index],
          onChange: (e) => {
            const value = e.target.value;
            if (isValidNumber(value)) {
              editMaxGpl(index, value);
            }
          }
        }}
        yanContribution={{
          value: yanContributions[index],
          onChange: (e) => {
            const value = e.target.value;
            if (isValidNumber(value)) {
              editYanContribution(index, value);
            }
          }
        }}
        providedYan={{
          value: providedYan[index],
          onChange: (e) => {
            const value = e.target.value;
            if (isValidNumber(value)) {
              updateProvidedYan(index, e.target.value);
            }
          }
        }}
        adjustAllowed={adjustAllowed}
        setAdjustAllowed={setAdjustAllowed}
        tutorialClassFlag={index === 0}
      />
    </label>
  );
};
