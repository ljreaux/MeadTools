"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { groupEquipment } from "@meadtools/inventory-domain";
import type { BrewContainerChange } from "@meadtools/api-contract/contracts";
import { useParams } from "next/navigation";
import { useBrewInventory } from "./BrewInventoryProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import SearchableInput from "@/components/ui/SearchableInput";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

/** The draft is local to the stage form; the server saves allocation and stage together. */
export function useBrewContainerChoice(open: boolean, expanded = false) {
  const inventory = useBrewInventory();
  const inputId = useId();
  const { brew_id: brewId } = useParams<{ brew_id: string }>();
  const { t } = useTranslation();
  const [draft, setDraftState] = useState<{
    ids: string[];
    expected: string[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [includedGroups, setIncludedGroups] = useState<string[]>([]);
  const [editing, setEditing] = useState(expanded);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setDraftState(null);
      setIncludedGroups([]);
      setEditing(expanded);
    }
  }
  const operation = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => {
    if (!open) operation.current = null;
  }, [open]);
  const current = (inventory?.equipment?.equipment ?? [])
    .filter((unit) => unit.brew?.id === brewId)
    .map((unit) => unit.id);
  const selected = draft?.ids ?? current;
  function setDraft(ids: string[]) {
    setDraftState((previous) => ({
      ids,
      expected: previous?.expected ?? current,
    }));
  }
  function reset() {
    setDraftState(null);
    setIncludedGroups([]);
    setEditing(expanded);
  }
  const groups = groupEquipment(
    (inventory?.equipment?.equipment ?? []).filter(
      (unit) => unit.type === "vessel",
    ),
  );
  const signature = JSON.stringify([draft?.expected ?? current, selected]);
  function change(): BrewContainerChange | undefined {
    if (
      !inventory?.canManage ||
      draft === null ||
      JSON.stringify([...current].sort()) ===
        JSON.stringify([...selected].sort())
    )
      return undefined;
    if (operation.current?.signature !== signature)
      operation.current = { signature, id: crypto.randomUUID() };
    return {
      operation_id: operation.current.id,
      expected_ids: draft.expected,
      equipment_ids: selected,
    };
  }
  const active = groups.filter(
    (group) =>
      group.units.some((unit) => selected.includes(unit.id)) ||
      includedGroups.includes(group.id),
  );
  const options = groups
    .filter(
      (group) =>
        !active.some((value) => value.id === group.id) &&
        group.units.some((unit) => !unit.brew || unit.brew.id === brewId),
    )
    .map((group) => ({
      id: group.id,
      label: `${group.item.name}${group.item.capacity ? ` · ${group.item.capacity.value} ${t(`equipment.units.${group.item.capacity.unit}`)}` : ""} · ${t("equipment.groupAvailability", { available: group.available, total: group.total })}`,
    }));
  const field = inventory?.canManage ? (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t("brewInventory.containersForStage")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(!editing)}
        >
          {t(
            editing
              ? "brewInventory.doneContainers"
              : "brewInventory.changeContainers",
          )}
        </Button>
      </div>
      {!editing ? (
        <p className="text-sm text-muted-foreground">
          {active
            .filter((group) =>
              group.units.some((unit) => selected.includes(unit.id)),
            )
            .map(
              (group) =>
                `${group.item.name} × ${group.units.filter((unit) => selected.includes(unit.id)).length}`,
            )
            .join(", ") || t("brewInventory.noContainers")}
        </p>
      ) : null}
      {inventory.equipmentLoading ? (
        <p role="status">{t("equipment.loading")}</p>
      ) : inventory.equipmentError ? (
        <p role="alert">{t("equipment.loadError")}</p>
      ) : editing ? (
        <>
          {active.map((group) => {
            const eligible = group.units.filter(
              (unit) => !unit.brew || unit.brew.id === brewId,
            );
            const unlabeled = eligible.filter((unit) => !unit.label);
            const labeled = eligible.filter((unit) => unit.label);
            const count = unlabeled.filter((unit) =>
              selected.includes(unit.id),
            ).length;
            return (
              <div
                key={group.id}
                className="space-y-2 rounded-md bg-muted/20 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{group.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.item.capacity
                        ? `${group.item.capacity.value} ${t(`equipment.units.${group.item.capacity.unit}`)} · `
                        : ""}
                      {t("equipment.groupAvailability", {
                        available: group.available,
                        total: group.total,
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIncludedGroups((previous) =>
                        previous.filter((id) => id !== group.id),
                      );
                      setDraft(
                        selected.filter(
                          (id) => !group.units.some((unit) => unit.id === id),
                        ),
                      );
                    }}
                  >
                    {t("equipment.remove")}
                  </Button>
                </div>
                {unlabeled.length ? (
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`count-${inputId}-${group.id}`}>
                      {t(
                        labeled.length
                          ? "brewInventory.unlabeledCount"
                          : "equipment.quantityAssigned",
                      )}
                    </Label>
                    <Input
                      id={`count-${inputId}-${group.id}`}
                      aria-label={t("brewInventory.containerCount", {
                        name: group.item.name,
                      })}
                      type="number"
                      className="w-20"
                      min={0}
                      max={unlabeled.length}
                      value={count}
                      onChange={(event) => {
                        setIncludedGroups((previous) =>
                          previous.includes(group.id)
                            ? previous
                            : [...previous, group.id],
                        );
                        const next = Number(event.target.value);
                        if (
                          Number.isInteger(next) &&
                          next >= 0 &&
                          next <= unlabeled.length
                        )
                          setDraft([
                            ...selected.filter(
                              (id) => !unlabeled.some((unit) => unit.id === id),
                            ),
                            ...unlabeled
                              .filter((unit) => selected.includes(unit.id))
                              .concat(
                                unlabeled.filter(
                                  (unit) => !selected.includes(unit.id),
                                ),
                              )
                              .slice(0, next)
                              .map((unit) => unit.id),
                          ]);
                      }}
                    />
                  </div>
                ) : null}
                {labeled.length ? (
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue={
                      labeled.some((unit) => selected.includes(unit.id))
                        ? "labels"
                        : undefined
                    }
                  >
                    <AccordionItem value="labels" className="border-0">
                      <AccordionTrigger className="py-1 text-xs text-muted-foreground">
                        {t("equipment.optionalLabels")}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mt-2 space-y-2">
                          {labeled.map((unit) => (
                            <label
                              key={unit.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selected.includes(unit.id)}
                                onCheckedChange={(checked) => {
                                  setIncludedGroups((previous) =>
                                    previous.includes(group.id)
                                      ? previous
                                      : [...previous, group.id],
                                  );
                                  setDraft(
                                    checked
                                      ? [...selected, unit.id]
                                      : selected.filter((id) => id !== unit.id),
                                  );
                                }}
                              />
                              {unit.label}
                            </label>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </div>
            );
          })}
          {options.length ? (
            <div className="space-y-2">
              <Label htmlFor={`add-containers-${inputId}`}>
                {t("brewInventory.addContainer")}
              </Label>
              <SearchableInput
                id={`add-containers-${inputId}`}
                items={options}
                query={query}
                setQuery={setQuery}
                keyName="label"
                getValue={(item) => item.id}
                placeholder={t("brewInventory.addContainer")}
                onSelect={(option) => {
                  const group = groups.find((group) => group.id === option.id)!;
                  const unit =
                    group.units.find((unit) => !unit.brew && !unit.label) ??
                    group.units.find(
                      (unit) => !unit.brew || unit.brew.id === brewId,
                    );
                  if (unit) setDraft([...selected, unit.id]);
                  setQuery("");
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {expanded ? (
        <p className="text-xs text-muted-foreground">
          {t("brewInventory.containerStageHint")}
        </p>
      ) : null}
    </div>
  ) : null;
  // Closing the form discards its allocation draft.
  return {
    field: open ? field : null,
    change,
    reset,
    changePending:
      draft !== null &&
      JSON.stringify([...current].sort()) !==
        JSON.stringify([...selected].sort()),
    valid:
      !inventory?.canManage ||
      draft === null ||
      (!inventory.equipmentLoading && !inventory.equipmentError),
  };
}
