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
  defaultInventoryView,
  inventorySortFieldSchema,
  type InventoryView,
} from "@meadtools/inventory-domain";
import type { InventoryOrganizationResponse } from "@meadtools/api-contract/contracts";
import DragList from "@/components/ui/DragList";
import SearchableInput from "@/components/ui/SearchableInput";
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
  const [filterQuery, setFilterQuery] = useState("");
  const [filterKey, setFilterKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  function filter(value: string) {
    const [kind, item] = value.split(":");
    if (kind === "label")
      setView({ ...view, labels: [...new Set([...view.labels, item])] });
    if (kind === "location")
      setView({ ...view, locations: [...new Set([...view.locations, item])] });
    if (kind === "type")
      setView({ ...view, types: [...new Set([...view.types, item])] });
    if (kind === "availability")
      setView({ ...view, availability: item as InventoryView["availability"] });
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
  const filterOptions = [
    ...(view.labels.length < 50 ? (organization?.labels ?? []) : [])
      .filter((row) => !view.labels.includes(row.id))
      .map((row) => ({
        value: `label:${row.id}`,
        name: t("inventory.organization.filterCategory", { name: row.name }),
      })),
    ...(view.locations.length < 50 ? (organization?.locations ?? []) : [])
      .filter((row) => !view.locations.includes(row.id))
      .map((row) => ({
        value: `location:${row.id}`,
        name: t("inventory.organization.filterLocation", { name: row.path }),
      })),
    ...types
      .filter((type) => !view.types.includes(type))
      .map((type) => ({
        value: `type:${type}`,
        name: t("inventory.organization.filterType", {
          name: t(`inventory.categories.${type}`),
        }),
      })),
    ...(["in_stock", "empty"] as const).map((value) => ({
      value: `availability:${value}`,
      name: t(`inventory.organization.${value}`),
    })),
  ];
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
            className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3"
          >
            <Label htmlFor={`${id}-filter`}>
              {t("inventory.organization.addFilter")}
            </Label>
            <SearchableInput
              openOnFocus={false}
              dropdownPortal
              key={filterKey}
              id={`${id}-filter`}
              items={filterOptions}
              keyName="name"
              query={filterQuery}
              setQuery={setFilterQuery}
              placeholder={t("inventory.organization.addFilter")}
              onSelect={(option) => {
                filter(option.value);
                setFilterQuery("");
                setFilterKey((key) => key + 1);
                setFiltersOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
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
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`${id}-sort`}>
            {t("inventory.organization.sort")}
          </Label>
          {fields.some(
            (field) => !view.sorts.some((sort) => sort.field === field),
          ) ? (
            <Select
              value=""
              onValueChange={(field: InventoryView["sorts"][number]["field"]) =>
                setView({
                  ...view,
                  sorts: [...view.sorts, { field, direction: "asc" }],
                })
              }
            >
              <SelectTrigger
                id={`${id}-sort`}
                className="h-8 w-auto min-w-40 text-sm"
              >
                <SelectValue
                  placeholder={t("inventory.organization.addSort")}
                />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter(
                    (field) => !view.sorts.some((sort) => sort.field === field),
                  )
                  .map((field) => (
                    <SelectItem key={field} value={field}>
                      {t(`inventory.organization.sortFields.${field}`)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setView({
                ...view,
                sorts: structuredClone(defaultInventoryView.sorts),
              })
            }
          >
            {t("inventory.organization.resetSort")}
          </Button>
        </div>
        <DragList
          layout="wrapped"
          getDragLabel={(sort) =>
            t("inventory.organization.dragRule", {
              name: t(`inventory.organization.sortFields.${sort.field}`),
            })
          }
          dragInstructions={t("inventory.organization.dragInstructions")}
          items={view.sorts}
          getId={(sort) => sort.field}
          setItems={(sorts) => setView({ ...view, sorts })}
          renderItem={(sort, index) => (
            <div className="flex flex-wrap items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <span className="mr-1">
                {index + 1}.{" "}
                {t(`inventory.organization.sortFields.${sort.field}`)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("inventory.organization.toggleDirection", {
                  name: t(`inventory.organization.sortFields.${sort.field}`),
                })}
                onClick={() =>
                  setView({
                    ...view,
                    sorts: view.sorts.map((row) =>
                      row.field === sort.field
                        ? {
                            ...row,
                            direction: row.direction === "asc" ? "desc" : "asc",
                          }
                        : row,
                    ),
                  })
                }
              >
                {sort.direction === "asc" ? (
                  <ArrowUp aria-hidden className="h-4 w-4" />
                ) : (
                  <ArrowDown aria-hidden className="h-4 w-4" />
                )}
                <span className="text-xs">
                  {t(`inventory.organization.${sort.direction}`)}
                </span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={index === 0}
                aria-label={t("inventory.organization.moveEarlier", {
                  name: t(`inventory.organization.sortFields.${sort.field}`),
                })}
                onClick={() => {
                  const sorts = [...view.sorts];
                  [sorts[index - 1], sorts[index]] = [
                    sorts[index],
                    sorts[index - 1],
                  ];
                  setView({ ...view, sorts });
                }}
              >
                <ArrowUp aria-hidden className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={index === view.sorts.length - 1}
                aria-label={t("inventory.organization.moveLater", {
                  name: t(`inventory.organization.sortFields.${sort.field}`),
                })}
                onClick={() => {
                  const sorts = [...view.sorts];
                  [sorts[index], sorts[index + 1]] = [
                    sorts[index + 1],
                    sorts[index],
                  ];
                  setView({ ...view, sorts });
                }}
              >
                <ArrowDown aria-hidden className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("inventory.organization.removeSort", {
                  name: t(`inventory.organization.sortFields.${sort.field}`),
                })}
                onClick={() =>
                  setView({
                    ...view,
                    sorts: view.sorts.filter((row) => row.field !== sort.field),
                  })
                }
              >
                <X aria-hidden className="h-3 w-3" />
              </Button>
            </div>
          )}
        />
        <p className="sr-only">{t("inventory.organization.sortHelp")}</p>
      </div>
    </div>
  );
}
