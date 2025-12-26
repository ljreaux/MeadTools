"use client";

import { useTranslation } from "react-i18next";
import { Pencil, PencilOff, Settings } from "lucide-react";

import Tooltip from "../Tooltips";
import { cn } from "@/lib/utils";
import { isValidNumber } from "@/lib/utils/validateInput";

import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../ui/dialog";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "../ui/input-group";

import { useNutrients } from "@/components/providers/NutrientProvider";
import type { NutrientKey } from "@/types/nutrientData";

export default function NutrientSelector() {
  const { t } = useTranslation();
  const { data, actions } = useNutrients();

  const warnNumberOfAdditions =
    Number(data.inputs.sg) > 1.08 && data.inputs.numberOfAdditions === "1";

  const nutrientRows: Array<{
    key: NutrientKey;
    labelKey: string;
  }> = [
    { key: "fermO", labelKey: "nutrients.fermO" },
    { key: "fermK", labelKey: "nutrients.fermK" },
    { key: "dap", labelKey: "nutrients.dap" }
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-1">
          {t("selectNutes")}
          <Tooltip
            body={t("tipText.preferredSchedule")}
            link="https://wiki.meadtools.com/en/process/nutrient_schedules"
          />
        </h3>
      </div>

      {/* Nutrient switches */}
      <div className="joyride-nutrientSwitches grid sm:grid-cols-2 gap-2">
        {nutrientRows.map((row, index) => (
          <LabeledNutrient
            key={row.key}
            nutrientKey={row.key}
            labelKey={row.labelKey}
            index={index}
          />
        ))}

        {/* Other */}
        <label className="flex items-center gap-2">
          <Switch
            checked={data.selected.selectedNutrients.other}
            onCheckedChange={() => actions.toggleNutrient("other")}
          />
          <span>{t("other.label")}</span>
        </label>

        {/* Other details */}
        {data.selected.selectedNutrients.other && (
          <div className="grid grid-cols-2 gap-4 w-full col-span-2 py-6">
            <h3 className="col-span-2">{t("other.detailsHeading")}</h3>

            {/* Name */}
            <label className="grid gap-1 col-span-2">
              <span className="text-sm font-medium">
                {t("sortLabels.name")}
              </span>

              <InputGroup className="h-12">
                <InputGroupInput
                  value={data.settings.other.name}
                  onChange={(e) => actions.setOtherNutrientName(e.target.value)}
                  inputMode="text"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
              </InputGroup>
            </label>

            {/* YAN Contribution */}
            <label className="grid gap-1">
              <span className="text-sm font-medium">
                {t("other.yanContribution")}
              </span>

              <InputGroup className="h-12">
                <InputGroupInput
                  value={data.settings.yanContribution.other}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isValidNumber(v)) actions.setOtherYanContribution(v);
                  }}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="px-2 text-xs sm:text-sm whitespace-nowrap mr-1"
                >
                  {t("nuteResults.sideLabels.ppmYan")}
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
                  value={data.settings.maxGpl.other}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isValidNumber(v)) actions.setMaxGpl("other", v);
                  }}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="px-2 text-xs sm:text-sm whitespace-nowrap mr-1"
                >
                  {t("units.gpl")}
                </InputGroupAddon>
              </InputGroup>
            </label>
          </div>
        )}
      </div>

      {/* Number of additions */}
      <div>
        <label className="joyride-numOfAdditions grid gap-1 mt-4">
          <span className="flex items-center gap-1">
            {t("numberOfAdditions")}
            <Tooltip
              body={t("tipText.numberOfAdditions")}
              variant={warnNumberOfAdditions ? "warning" : undefined}
            />
          </span>

          <Select
            value={data.inputs.numberOfAdditions}
            onValueChange={actions.setNumberOfAdditions}
          >
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

function LabeledNutrient({
  nutrientKey,
  labelKey,
  index
}: {
  nutrientKey: NutrientKey;
  labelKey: string;
  index: number;
}) {
  const { t } = useTranslation();
  const { data, actions } = useNutrients();

  const checked = data.selected.selectedNutrients[nutrientKey];

  return (
    <label className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={() => actions.toggleNutrient(nutrientKey)}
      />

      {t(labelKey)}

      <SettingsDialog nutrientKey={nutrientKey} index={index} />
    </label>
  );
}

function SettingsDialog({
  nutrientKey,
  index
}: {
  nutrientKey: NutrientKey;
  index: number;
}) {
  const { t } = useTranslation();
  const { data, actions } = useNutrients();

  const maxGpl = data.settings.maxGpl[nutrientKey];
  const yanContribution = data.settings.yanContribution[nutrientKey];
  const providedYan = data.adjustments.providedYanPpm[nutrientKey];
  const adjustAllowed = data.adjustments.adjustAllowed;

  return (
    <Dialog>
      <DialogTrigger className={index === 0 ? "joyride-nutrientSettings" : ""}>
        <Settings />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("other.settingsTitle")}</DialogTitle>

          <DialogDescription asChild>
            <div className="flex flex-col gap-4 pt-2">
              {/* YAN Contribution */}
              <div className="px-2">
                <label className="grid gap-1 text-sm font-medium">
                  <span>{t("other.yanContribution")}</span>

                  <InputGroup className="h-12">
                    <InputGroupInput
                      value={yanContribution}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isValidNumber(v))
                          actions.setYanContribution(nutrientKey, v);
                      }}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                    />
                    <InputGroupAddon align="inline-end">
                      {t("nuteResults.sideLabels.ppmYan")}
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
                      value={maxGpl}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isValidNumber(v)) actions.setMaxGpl(nutrientKey, v);
                      }}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                    />
                    <InputGroupAddon align="inline-end">
                      <span>g/L</span>
                    </InputGroupAddon>
                  </InputGroup>
                </label>
              </div>

              {/* Provided YAN + adjust toggle */}
              <div className="px-2">
                <label className="grid gap-1 text-sm font-medium w-full">
                  <span>{t("other.settingsProvidedYan")}</span>

                  <InputGroup className="h-12">
                    <InputGroupAddon align="inline-start">
                      <InputGroupButton
                        size="icon-xs"
                        aria-pressed={adjustAllowed}
                        aria-label={t("other.settingsAdjustValue")}
                        onClick={() => actions.setAdjustAllowed(!adjustAllowed)}
                      >
                        {adjustAllowed ? <Pencil /> : <PencilOff />}
                      </InputGroupButton>
                    </InputGroupAddon>

                    <InputGroupInput
                      value={providedYan}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isValidNumber(v))
                          actions.setProvidedYanPpm(nutrientKey, v);
                      }}
                      onFocus={(e) => e.target.select()}
                      inputMode="decimal"
                      readOnly={!adjustAllowed}
                      data-warning={adjustAllowed ? "true" : undefined}
                    />

                    <InputGroupAddon align="inline-end">
                      <span>{t("nuteResults.sideLabels.ppmYan")}</span>
                      <span className={cn("sm:hidden")}>
                        <Tooltip body={t("tipText.adjustYanValue")} />
                      </span>
                    </InputGroupAddon>
                  </InputGroup>

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
}
