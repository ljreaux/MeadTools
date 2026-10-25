"use client";

import { useId, useMemo, useRef, useState } from "react";
import { groupEquipment } from "@meadtools/inventory-domain";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  X,
  Wrench,
  Container,
  Pencil,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import type {
  EquipmentItem,
  EquipmentBrewSummary,
  CreateEquipmentRequestBody,
} from "@meadtools/api-contract/contracts";
import {
  equipmentOverviewResponseSchema,
  equipmentMutationResponseSchema,
} from "@meadtools/api-contract/equipment";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { qk } from "@/lib/db/queryKeys";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import SearchableInput from "@/components/ui/SearchableInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EquipmentEditor } from "./EquipmentEditor";

type Command = {
  id?: string;
  body:
    | {
        equipment: CreateEquipmentRequestBody["equipment"];
        quantity?: number;
        action?: "edit" | "edit_group";
      }
    | { action: "archive" | "archive_group" }
    | { action: "label"; label: string | null }
    | {
        action: "allocate";
        brew_id: string;
        quantity: number;
        expected_ids: string[];
      }
    | {
        action: "assign";
        brew_id: string | null;
        expected_brew_id: string | null;
        reassign: boolean;
      };
};
class EquipmentRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function EquipmentWorkspace() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const token = useAuthToken();
  const client = useQueryClient();
  const [filter, setFilter] = useState<"all" | "vessel" | "other">("all");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ item: EquipmentItem | null } | null>(
    null,
  );
  const [assignment, setAssignment] = useState<EquipmentItem | null>(null);
  const [removing, setRemoving] = useState<EquipmentItem | null>(null);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const queryKey = ["account", "equipment", user?.id] as const;
  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
    });
    const body = await response.json();
    if (!response.ok) throw new EquipmentRequestError(body.code ?? "FAILED");
    return body;
  }
  const overview = useQuery({
    queryKey,
    enabled: Boolean(user),
    retry: false,
    queryFn: async () =>
      equipmentOverviewResponseSchema.parse(
        await request("/api/account/equipment"),
      ),
  });
  const mutation = useMutation({
    mutationFn: async (command: Command) => {
      const signature = JSON.stringify(command);
      if (operation.current?.signature !== signature)
        operation.current = { signature, id: crypto.randomUUID() };
      return equipmentMutationResponseSchema.parse(
        await request(
          `/api/account/equipment${command.id ? `/${command.id}` : ""}`,
          {
            method: command.id ? "PATCH" : "POST",
            body: JSON.stringify({
              ...command.body,
              operation_id: operation.current.id,
            }),
          },
        ),
      );
    },
    onSuccess: async () => {
      operation.current = null;
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ["account", "brew-inventory"] }),
        client.invalidateQueries({ queryKey: qk.accountBrews.all }),
      ]);
    },
  });
  const error = mutation.error
    ? t(
        `equipment.errors.${mutation.error instanceof EquipmentRequestError ? mutation.error.code : "FAILED"}`,
        t("equipment.saveError"),
      )
    : "";
  async function save(command: Command, close: () => void) {
    try {
      await mutation.mutateAsync(command);
      close();
    } catch {
      /* Keep form values and the operation ID for retry. */
    }
  }
  function openEditor(item: EquipmentItem | null) {
    mutation.reset();
    setEditor({ item });
  }
  const data = overview.data;
  if (overview.isPending)
    return (
      <div role="status" className="py-16 text-center text-muted-foreground">
        {t("equipment.loading")}
      </div>
    );
  if (overview.isError || !data)
    return (
      <div role="alert" className="space-y-3 py-12 text-center">
        <p>{t("equipment.loadError")}</p>
        <Button variant="outline" onClick={() => void overview.refetch()}>
          {t("equipment.retry")}
        </Button>
      </div>
    );
  const groups = groupEquipment(data.equipment);
  const visible = groups.filter(({ units }) =>
    units.some(
      (item) =>
        (filter === "all" || item.type === filter) &&
        `${item.name} ${item.label ?? ""} ${item.notes ?? ""} ${item.brew?.name ?? ""} ${item.brew?.recipe_name ?? ""}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ),
  );
  const occupied = data.equipment.filter((item) => item.brew).length;
  const available = data.equipment.filter(
    (item) => item.type === "vessel" && !item.brew,
  ).length;
  return (
    <Tabs
      value={filter}
      onValueChange={(value) => setFilter(value as typeof filter)}
    >
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2 sm:pt-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("equipment.title")}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {t("equipment.description")}
            </p>
          </div>
          {data.can_manage ? (
            <Button onClick={() => openEditor(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("equipment.add")}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: data.equipment.length, label: "equipment.total" },
            { value: occupied, label: "equipment.inUse" },
            { value: available, label: "equipment.availableVessels" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-xl border bg-muted/20 p-4"
            >
              <p className="text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {t(stat.label)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label={t("equipment.filter")}>
            {(["all", "vessel", "other"] as const).map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`equipment.filters.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <InputGroup className="w-full sm:max-w-sm">
            <InputGroupInput
              type="search"
              className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("equipment.search")}
              placeholder={t("equipment.search")}
            />
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            {search ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={t("clear")}
                  title={t("clear")}
                  onClick={() => setSearch("")}
                >
                  <X aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>
        <PremiumCollectionNotice key={String(data.can_manage)} canManage={data.can_manage} description={t("equipment.readOnly")}>
        <TabsContent value={filter}>
          {visible.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((group) => {
                const item = group.item;
                const occupied = group.units.some((unit) => unit.brew);
                const allocations = Array.from(
                  new Map(
                    group.units
                      .filter((unit) => unit.brew)
                      .map((unit) => [unit.brew!.id, unit.brew!]),
                  ).values(),
                );
                return (
                  <article
                    key={item.id}
                    className="flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className="rounded-lg bg-muted p-2">
                        {item.type === "vessel" ? (
                          <Container aria-hidden className="h-5 w-5" />
                        ) : (
                          <Wrench aria-hidden className="h-5 w-5" />
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${occupied ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {t(
                          item.type === "other"
                            ? "equipment.tool"
                            : occupied
                              ? "equipment.inUse"
                              : "equipment.available",
                        )}
                      </span>
                    </div>
                    <h2 className="break-words text-base font-semibold">
                      {item.name}{" "}
                      <span className="text-muted-foreground">
                        × {group.total}
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("equipment.groupAvailability", {
                        available: group.available,
                        total: group.total,
                      })}
                    </p>
                    {item.capacity ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Intl.NumberFormat(i18n.language, {
                          maximumFractionDigits: 6,
                        }).format(item.capacity.value)}{" "}
                        {t(`equipment.units.${item.capacity.unit}`)}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-3 break-words text-sm text-muted-foreground">
                        {item.notes}
                      </p>
                    ) : null}
                    <div className="mt-4 flex-1 border-t pt-3 text-sm">
                      {allocations.length ? (
                        allocations.map((brew) => (
                          <p key={brew.id}>
                            <Link
                              href={`/account/brews/${brew.id}`}
                              className="underline underline-offset-4"
                            >
                              {brew.name ??
                                brew.recipe_name ??
                                t("equipment.untitledBrew")}
                            </Link>{" "}
                            ×{" "}
                            {
                              group.units.filter(
                                (unit) => unit.brew?.id === brew.id,
                              ).length
                            }
                          </p>
                        ))
                      ) : (
                        <p className="text-muted-foreground">
                          {t(
                            item.type === "vessel"
                              ? "equipment.notAssigned"
                              : "equipment.readyToUse",
                          )}
                        </p>
                      )}
                      {(data.can_manage ||
                        group.units.some((unit) => unit.label)) &&
                      item.type === "vessel" ? (
                        <Accordion type="single" collapsible className="mt-3">
                          <AccordionItem value="labels" className="border-0">
                            <AccordionTrigger className="py-1 text-sm">
                              {t("equipment.optionalLabels")}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="mt-2 space-y-2">
                                {group.units.map((unit, index) => (
                                  <div key={unit.id} className="space-y-1">
                                    <Label htmlFor={`label-${unit.id}`}>
                                      {t("equipment.unitLabel", {
                                        number: index + 1,
                                      })}
                                    </Label>
                                    <Input
                                      id={`label-${unit.id}`}
                                      defaultValue={unit.label ?? ""}
                                      placeholder={t(
                                        "equipment.labelPlaceholder",
                                      )}
                                      maxLength={100}
                                      disabled={
                                        !data.can_manage || mutation.isPending
                                      }
                                      onBlur={(event) => {
                                        const label =
                                          event.target.value.trim() || null;
                                        if (label !== unit.label)
                                          void save(
                                            {
                                              id: unit.id,
                                              body: { action: "label", label },
                                            },
                                            () => {},
                                          );
                                      }}
                                    />
                                    {unit.brew ? (
                                      <p className="text-xs text-muted-foreground">
                                        {unit.brew.name ??
                                          unit.brew.recipe_name}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : null}
                    </div>
                    {data.can_manage ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.type === "vessel" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              mutation.reset();
                              setAssignment(item);
                            }}
                          >
                            <ArrowRightLeft
                              aria-hidden
                              className="mr-1 h-3.5 w-3.5"
                            />
                            {t("equipment.assignment")}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditor(item)}
                          aria-label={t("equipment.editNamed", {
                            name: item.name,
                          })}
                        >
                          <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" />
                          {t("equipment.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={occupied}
                          onClick={() => {
                            mutation.reset();
                            setRemoving(item);
                          }}
                          aria-label={t("equipment.removeNamed", {
                            name: item.name,
                          })}
                        >
                          <Trash2 aria-hidden className="mr-1 h-3.5 w-3.5" />
                          {t("equipment.remove")}
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Wrench
                aria-hidden
                className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
              />
              <h2 className="font-semibold">
                {t(
                  data.equipment.length
                    ? "equipment.noMatches"
                    : "equipment.emptyTitle",
                )}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  data.equipment.length
                    ? "equipment.changeSearch"
                    : "equipment.emptyDescription",
                )}
              </p>
            </div>
          )}
        </TabsContent>
        </PremiumCollectionNotice>
        {editor && data.can_manage ? (
          <EquipmentEditor
            key={editor.item?.id ?? "new"}
            item={editor.item}
            total={
              groups.find((group) => group.id === editor.item?.group_id)
                ?.total ?? 1
            }
            busy={mutation.isPending}
            error={error}
            onClose={() => setEditor(null)}
            onSave={(value, quantity) =>
              save(
                {
                  id: editor.item?.id,
                  body: editor.item
                    ? { action: "edit_group", equipment: value, quantity }
                    : { equipment: value, quantity },
                },
                () => setEditor(null),
              )
            }
          />
        ) : null}
        {assignment && data.can_manage ? (
          <AssignmentDialog
            item={assignment}
            units={data.equipment.filter(
              (unit) => unit.group_id === assignment.group_id,
            )}
            brews={data.brews}
            busy={mutation.isPending}
            error={error}
            onClose={() => setAssignment(null)}
            onSave={(brewId, quantity) =>
              save(
                {
                  id: assignment.id,
                  body:
                    quantity !== undefined && brewId
                      ? {
                          action: "allocate",
                          brew_id: brewId,
                          quantity,
                          expected_ids: data.equipment
                            .filter(
                              (unit) =>
                                unit.group_id === assignment.group_id &&
                                unit.brew?.id === brewId,
                            )
                            .map((unit) => unit.id),
                        }
                      : {
                          action: "assign",
                          brew_id: brewId,
                          expected_brew_id: assignment.brew?.id ?? null,
                          reassign: Boolean(
                            assignment.brew &&
                            brewId &&
                            brewId !== assignment.brew.id,
                          ),
                        },
                },
                () => setAssignment(null),
              )
            }
          />
        ) : null}
        {removing && data.can_manage ? (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open && !mutation.isPending) setRemoving(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("equipment.removeTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("equipment.removeDescription", { name: removing.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={mutation.isPending}>
                  {t("equipment.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  asChild
                  onClick={(event) => event.preventDefault()}
                >
                  <LoadingButton
                    variant="destructive"
                    loading={mutation.isPending}
                    loadingText={t("equipment.saving")}
                    onClick={() =>
                      void save(
                        { id: removing.id, body: { action: "archive_group" } },
                        () => setRemoving(null),
                      )
                    }
                  >
                    {t("equipment.remove")}
                  </LoadingButton>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </section>
    </Tabs>
  );
}

const brewOptionValue = (option: { id: string }) => option.id;

function AssignmentDialog({
  item,
  units,
  brews,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: EquipmentItem;
  units: EquipmentItem[];
  brews: EquipmentBrewSummary[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (brewId: string | null, quantity?: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [quantity, setQuantity] = useState(String(item.brew ? units.filter(unit=>unit.brew?.id===item.brew!.id).length : 1));
  const pooled = units.length > 1;
  const [brewId, setBrewId] = useState<string | null>(item.brew?.id ?? "");
  const [brewQuery, setBrewQuery] = useState(item.brew?.id ?? (pooled ? "" : "unassigned"));
  const options = useMemo(
    () => [
      ...(!pooled
        ? [{ id: "unassigned", label: t("equipment.unassigned") }]
        : []),
      ...brews.map((brew) => ({
        id: brew.id,
        label:
          [brew.name, brew.recipe_name]
            .filter(
              (name, index, names) => name && names.indexOf(name) === index,
            )
            .join(" — ") || t("equipment.untitledBrew"),
      })),
    ],
    [brews, t, pooled],
  );
  const reassigning = Boolean(item.brew && brewId && item.brew.id !== brewId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="focus:outline-none"
          >
            {t("equipment.assignmentTitle", { name: item.name })}
          </DialogTitle>
          <DialogDescription>
            {t("equipment.assignmentDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (brewId !== null)
              void onSave(
                brewId || null,
                pooled ? Number(quantity) : undefined,
              );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={id}>{t("equipment.brew")}</Label>
            <SearchableInput
              id={id}
              disabled={busy}
              items={options}
              query={brewQuery}
              keyName="label"
              getValue={brewOptionValue}
              setQuery={(value) => {
                setBrewQuery(value);
                setBrewId(null);
              }}
              onSelect={(option) => {
                setBrewQuery(option.id);
                setBrewId(option.id === "unassigned" ? "" : option.id);
                setQuantity(
                  String(
                    units.filter((unit) => unit.brew?.id === option.id)
                      .length || 1,
                  ),
                );
              }}
            />
          </div>
          {pooled ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-count`}>
                {t("equipment.quantityAssigned")}
              </Label>
              <Input
                id={`${id}-count`}
                type="number"
                min={0}
                max={
                  units.filter((unit) => !unit.brew || unit.brew.id === brewId)
                    .length
                }
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          ) : null}
          {!pooled && reassigning ? (
            <p className="rounded-md bg-muted p-3 text-sm">
              {t("equipment.reassignmentNotice", {
                name:
                  item.brew?.name ??
                  item.brew?.recipe_name ??
                  t("equipment.untitledBrew"),
              })}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t("equipment.cancel")}
            </Button>
            <LoadingButton
              type="submit"
              loading={busy}
              loadingText={t("equipment.saving")}
              disabled={
                pooled
                  ? !brewId ||
                    !Number.isInteger(Number(quantity)) ||
                    Number(quantity) < 0 ||
                    Number(quantity) >
                      units.filter(
                        (unit) => !unit.brew || unit.brew.id === brewId,
                      ).length
                  : brewId === (item.brew?.id ?? "")
              }
            >
              {t(
                !pooled && reassigning ? "equipment.reassign" : "equipment.saveAssignment",
              )}
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
