import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { Pencil, PencilOff, Settings } from "lucide-react";
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
import { Separator } from "../ui/separator";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "../ui/input-group";

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

  const handleNutrientChange = (nutrient: string) => {
    const prevSelected = selected?.selectedNutrients || [];

    if (prevSelected?.includes(nutrient)) {
      setSelectedNutrients(prevSelected.filter((item) => item !== nutrient));
    } else {
      setSelectedNutrients([...prevSelected, nutrient]);
    }
  };

  const warnNumberOfAdditions =
    Number(inputs.sg.value) > 1.08 && inputs.numberOfAdditions.value === "1";

  return (
    <>
      {/* Header + helper tooltip, consistent with other sections */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-1">
          {t("selectNutes")}
          <Tooltip
            body={t("tipText.preferredSchedule")}
            link="https://wiki.meadtools.com/en/process/nutrient_schedules"
          />
        </h3>
      </div>

      {/* Nutrient toggles */}
      <div className="joyride-nutrientSwitches grid sm:grid-cols-2 gap-2">
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

        {/* “Other” switch stays, but gets same pill styling */}
        <label className="flex items-center gap-2">
          <Switch
            checked={selected.selectedNutrients?.includes("Other")}
            onCheckedChange={() => handleNutrientChange("Other")}
          />
          <span>{t("other.label")}</span>
        </label>

        {selected.selectedNutrients?.includes("Other") && (
          <div className="grid grid-cols-2 gap-4 w-full col-span-2 py-6">
            <h3 className="col-span-2">
              {t("other.detailsHeading", "Other Nutrient Details")}
            </h3>

            {/* Name */}
            <label className="grid gap-1 col-span-2">
              <span className="text-sm font-medium">
                {t("other.nameLabel", "Name")}
              </span>

              <InputGroup className="h-12">
                <InputGroupInput
                  {...otherNutrientName}
                  inputMode="text"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
              </InputGroup>
            </label>

            {/* YAN Contribution */}
            <label className="grid gap-1">
              <span className="text-sm font-medium">
                {t("other.yanContribution", "YAN Contribution")}
              </span>

              <InputGroup className="h-12">
                <InputGroupInput
                  {...otherYanContribution}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="px-2 text-xs sm:text-sm whitespace-nowrap mr-1"
                >
                  {t("PPM")} YAN
                </InputGroupAddon>
              </InputGroup>
            </label>

            {/* Max g/L */}
            <label className="grid gap-1">
              <span className="text-sm font-medium">
                {t("other.maxGpl", "Max g/L")}
              </span>

              <InputGroup className="h-12">
                <InputGroupInput
                  value={maxGpl[3]}
                  onChange={(e) => editMaxGpl(3, e.target.value)}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="px-2 text-xs sm:text-sm whitespace-nowrap mr-1"
                >
                  g/L
                </InputGroupAddon>
              </InputGroup>
            </label>
          </div>
        )}
      </div>

      {/* Number of additions – your warning logic is good */}
      <div>
        <label className="joyride-numOfAdditions grid gap-1 mt-4">
          <span className="flex items-center gap-1">
            {t("numberOfAdditions")}
            <Tooltip
              body={t("tipText.numberOfAdditions")}
              variant={warnNumberOfAdditions ? "warning" : undefined}
            />
          </span>
          <Select {...inputs.numberOfAdditions}>
            <SelectTrigger
              className={cn("h-12", {
                "border-warning ring-warning/40": warnNumberOfAdditions
              })}
            >
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

      <Separator className="my-2" />
    </>
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
          <DialogTitle>
            {t("other.settingsTitle", "Adjust Nutrient Settings")}
          </DialogTitle>

          <DialogDescription asChild>
            <div className="flex flex-col gap-4 pt-2">
              {/* YAN Contribution */}
              <div className="px-2">
                <label className="grid gap-1 text-sm font-medium">
                  <span>
                    {t("other.settingsYanContribution", "YAN Contribution")}
                  </span>
                  <InputGroup className="h-12">
                    <InputGroupInput
                      {...yanContribution}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                    />
                    <InputGroupAddon align="inline-end">
                      <span>PPM YAN</span>
                    </InputGroupAddon>
                  </InputGroup>
                </label>
              </div>

              {/* Max g/L */}
              <div className="px-2">
                <label className="grid gap-1 text-sm font-medium">
                  <span>{t("other.settingsMaxGpl", "Max g/L")}</span>
                  <InputGroup className="h-12">
                    <InputGroupInput
                      {...maxGpl}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                    />
                    <InputGroupAddon align="inline-end">
                      <span>g/L</span>
                    </InputGroupAddon>
                  </InputGroup>
                </label>
              </div>

              {/* Provided YAN + inline adjust toggle inside the same input group */}
              <div className="px-2">
                <label className="grid gap-1 text-sm font-medium w-full">
                  <span>{t("other.settingsProvidedYan", "Provided YAN")}</span>

                  <InputGroup className="h-12">
                    {/* Left addon – adjust toggle as an input-group button */}
                    <InputGroupAddon align="inline-start">
                      <InputGroupButton
                        size="icon-xs"
                        aria-pressed={adjustAllowed}
                        aria-label={t(
                          "other.settingsAdjustValue",
                          "Toggle adjusting provided YAN"
                        )}
                        onClick={() => setAdjustAllowed(!adjustAllowed)}
                      >
                        {adjustAllowed ? <Pencil /> : <PencilOff />}
                      </InputGroupButton>
                    </InputGroupAddon>

                    {/* Main input */}
                    <InputGroupInput
                      {...providedYan}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                      readOnly={!adjustAllowed}
                      data-warning={adjustAllowed ? "true" : undefined}
                    />

                    {/* Right addon – units + mobile tooltip */}
                    <InputGroupAddon align="inline-end">
                      <span>PPM YAN</span>
                      <span className={cn("sm:hidden")}>
                        <Tooltip body={t("tipText.adjustYanValue")} />
                      </span>
                    </InputGroupAddon>
                  </InputGroup>

                  {/* Desktop-only helper text (same content as tooltip),
                      always rendered but hidden via `invisible` when not adjusting */}
                  <p
                    className={cn(
                      "hidden sm:block mt-1 text-xs text-warning",
                      !adjustAllowed && "invisible"
                    )}
                  >
                    {t("tipText.adjustYanValue")}
                  </p>
                </label>
              </div>
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
