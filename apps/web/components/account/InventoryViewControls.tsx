"use client";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  X,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";
import {
  inventorySortFieldSchema,
  type InventoryView,
} from "@meadtools/inventory-domain";
import type { InventoryOrganizationResponse } from "@meadtools/api-contract/contracts";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";

export function InventoryViewControls({
  view,
  setView,
  organization,
  types = [],
  meads = false,
}: {
  view: InventoryView;
  setView: (view: InventoryView) => void;
  organization?: InventoryOrganizationResponse;
  types?: readonly string[];
  meads?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  function toggle(key: "labels" | "locations" | "types", value: string) {
    const selected = view[key];
    setView({ ...view, [key]: selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value] });
  }
  const pills = [
    ...view.labels.map((value) => ({
      key: `label:${value}`,
      label:
        organization?.labels.find((row) => row.id === value)?.name ??
        t("inventory.organization.unavailableCategory"),
      remove: () =>
        setView({
          ...view,
          labels: view.labels.filter((item) => item !== value),
        }),
    })),
    ...view.locations.map((value) => ({
      key: `location:${value}`,
      label:
        organization?.locations.find((row) => row.id === value)?.path ??
        t("inventory.organization.unavailableLocation"),
      remove: () =>
        setView({
          ...view,
          locations: view.locations.filter((item) => item !== value),
        }),
    })),
    ...view.types.map((value) => ({
      key: `type:${value}`,
      label: t(`inventory.categories.${value}`),
      remove: () =>
        setView({
          ...view,
          types: view.types.filter((item) => item !== value),
        }),
    })),
    ...(view.availability === "all"
      ? []
      : [
          {
            key: "availability",
            label: t(`inventory.organization.${view.availability}`),
            remove: () => setView({ ...view, availability: "all" }),
          },
        ]),
  ];
  const fields = inventorySortFieldSchema.options.filter(
    (field) => meads || !["volume", "bottle_size"].includes(field),
  );
  const groups = [
    { key: "types" as const, title: t("inventory.organization.itemType"),
      options: types.map((value) => ({ value, name: t(`inventory.categories.${value}`) })) },
    { key: "labels" as const, title: t("inventory.organization.categories"),
      options: (organization?.labels ?? []).map((row) => ({ value: row.id, name: row.name })) },
    { key: "locations" as const, title: t("inventory.organization.locations"),
      options: (organization?.locations ?? []).map((row) => ({ value: row.id, name: row.path })) },
  ];
  const sort = view.sorts[0] && fields.includes(view.sorts[0].field)
    ? view.sorts[0] : { field: "name" as const, direction: "asc" as const };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-auto sm:min-w-64 sm:max-w-md sm:flex-1">
          <InputGroupInput
            type="search"
            maxLength={500}
            value={view.search}
            onChange={(event) =>
              setView({ ...view, search: event.target.value })
            }
            aria-label={t("inventory.search")}
            placeholder={t("inventory.organization.search")}
          />
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          {view.search ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={t("clear")}
                onClick={() => setView({ ...view, search: "" })}
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9">
              <Filter aria-hidden className="size-3.5" />
              {t("inventory.organization.filters")}
              {pills.length ? (
                <span className="tabular-nums text-muted-foreground">
                  ({pills.length})
                </span>
              ) : null}
              <ChevronDown aria-hidden className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto space-y-4 p-4"
          >
            {groups.filter((group) => group.options.length).map((group) => (
              <fieldset key={group.key} className="space-y-2 border-b pb-3 last:border-0">
                <legend className="mb-2 text-sm font-medium">{group.title}</legend>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {group.options.map((option) => (
                    <Label key={option.value} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-1 font-normal hover:bg-accent">
                      <Checkbox checked={view[group.key].includes(option.value)}
                        disabled={!view[group.key].includes(option.value) && view[group.key].length >= (group.key === "types" ? 10 : 50)}
                        onCheckedChange={() => toggle(group.key, option.value)} />
                      <span className="min-w-0 break-words">{option.name}</span>
                    </Label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="space-y-2">
              <Label htmlFor={`${id}-availability`}>{t("inventory.organization.availability")}</Label>
              <Select value={view.availability} onValueChange={(availability: InventoryView["availability"]) => setView({ ...view, availability })}>
                <SelectTrigger id={`${id}-availability`}><SelectValue /></SelectTrigger>
                <SelectContent>{(["all", "in_stock", "empty"] as const).map((value) => <SelectItem key={value} value={value}>{t(`inventory.organization.${value}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${id}-sort`}>{t("inventory.organization.sort")}</Label>
        <Select value={sort.field} onValueChange={(field: typeof sort.field) => setView({ ...view, sorts: [{ field, direction: sort.direction }] })}>
          <SelectTrigger id={`${id}-sort`} className="h-9 w-auto min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{fields.map((field) => <SelectItem key={field} value={field}>{t(`inventory.organization.sortFields.${field}`)}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" size="sm" variant="ghost" aria-label={`${t(`inventory.organization.${sort.direction}`)}. ${t("inventory.organization.reverseSort")}`}
          onClick={() => setView({ ...view, sorts: [{ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" }] })}>
          {sort.direction === "asc" ? <ArrowUp aria-hidden className="size-4" /> : <ArrowDown aria-hidden className="size-4" />}
          {t(`inventory.organization.${sort.direction}`)}
        </Button>
      </div>
      </div>
      {pills.length || view.search ? (
        <div className="flex flex-wrap items-center gap-2">
          {pills.map((pill) => (
            <Button
              key={pill.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-8 max-w-full gap-2 whitespace-normal text-left"
              onClick={pill.remove}
              aria-label={t("inventory.organization.removeFilter", {
                name: pill.label,
              })}
            >
              {pill.label}
              <X aria-hidden className="h-3 w-3 shrink-0" />
            </Button>
          ))}
          {pills.length || view.search ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setView({
                  ...view,
                  search: "",
                  labels: [],
                  locations: [],
                  types: [],
                  availability: "all",
                })
              }
            >
              {t("brews.filters.clear")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.labels.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`${id}-match`}>
            {t("inventory.organization.match")}
          </Label>
          <Select
            value={view.label_match}
            onValueChange={(value: "any" | "all") =>
              setView({ ...view, label_match: value })
            }
          >
            <SelectTrigger id={`${id}-match`} className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">
                {t("inventory.organization.matchAny")}
              </SelectItem>
              <SelectItem value="all">
                {t("inventory.organization.matchAll")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

    </div>
  );
}
