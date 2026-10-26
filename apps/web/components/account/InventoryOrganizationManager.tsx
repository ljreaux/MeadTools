"use client";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Plus } from "lucide-react";
import type {
  InventoryLabel,
  InventoryLocation,
} from "@meadtools/api-contract/contracts";
import {
  useInventoryOrganization,
  type OrganizationCommand,
} from "./InventoryOrganizationProvider";
import { InventoryRequestError } from "@/hooks/reactQuery/useInventory";
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import SearchableInput from "@/components/ui/SearchableInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Editor =
  | { kind: "label"; item: InventoryLabel | null }
  | { kind: "location"; item: InventoryLocation | null };
export function organizationError(error: unknown, t: TFunction) {
  return error
    ? t(
        `inventory.organization.errors.${error instanceof InventoryRequestError ? error.code : "FAILED"}`,
        t("inventory.saveError"),
      )
    : "";
}
export function InventoryOrganizationManager() {
  const { t } = useTranslation();
  const { overview, mutation } = useInventoryOrganization();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [archiving, setArchiving] = useState<Editor | null>(null);
  const data = overview.data;
  async function save(command: OrganizationCommand, close: () => void) {
    try {
      await mutation.mutateAsync(command);
      close();
    } catch {
      /* Preserve reviewed versions and retry identity. */
    }
  }
  if (overview.isPending) return <p role="status">{t("inventory.loading")}</p>;
  if (!data || overview.isError)
    return (
      <div role="alert">
        <p>{t("inventory.loadError")}</p>
        <Button onClick={() => void overview.refetch()}>
          {t("equipment.retry")}
        </Button>
      </div>
    );
  return (
    <section className="space-y-5 pt-4">
      <h2 className="text-xl font-semibold">
        {t("inventory.organization.manage")}
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t("inventory.organization.manageHelp")}
      </p>
      <PremiumCollectionNotice
        canManage={data.can_manage}
        description={t("inventory.readOnly")}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {(["label", "location"] as const).map((kind) => (
            <Card key={kind}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">
                  {t(
                    `inventory.organization.${kind === "label" ? "categories" : "locations"}`,
                  )}
                </CardTitle>
                {data.can_manage ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      mutation.reset();
                      setEditor({ kind, item: null });
                    }}
                  >
                    <Plus aria-hidden className="mr-1 h-4 w-4" />
                    {t(`inventory.organization.add_${kind}`)}
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(kind === "label" ? data.labels : data.locations).map(
                    (item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                      >
                        <span className="min-w-0 break-words text-sm">
                          {kind === "location"
                            ? (item as InventoryLocation).path
                            : item.name}
                        </span>
                        {data.can_manage ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t(
                                "inventory.organization.editNamed",
                                { name: item.name },
                              )}
                              onClick={() => {
                                mutation.reset();
                                setEditor(
                                  kind === "location"
                                    ? { kind, item: item as InventoryLocation }
                                    : { kind, item },
                                );
                              }}
                            >
                              {t("inventory.meads.actions.details")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t(
                                "inventory.organization.archiveNamed",
                                { name: item.name },
                              )}
                              onClick={() => {
                                mutation.reset();
                                setArchiving(
                                  kind === "location"
                                    ? { kind, item: item as InventoryLocation }
                                    : { kind, item },
                                );
                              }}
                            >
                              {t("inventory.meads.archive")}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ),
                  )}
                </ul>
                {!(kind === "label" ? data.labels : data.locations).length ? (
                  <p className="text-sm text-muted-foreground">
                    {t(`inventory.organization.empty_${kind}`)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </PremiumCollectionNotice>
      {editor && data.can_manage ? (
        <OrganizationEditor
          key={`${editor.kind}-${editor.item?.id ?? "new"}`}
          editor={editor}
          locations={data.locations}
          busy={mutation.isPending}
          error={organizationError(mutation.error, t)}
          onClose={() => {
            setEditor(null);
            void overview.refetch();
          }}
          onSave={(command) => save(command, () => setEditor(null))}
        />
      ) : null}
      {archiving?.item && data.can_manage ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !mutation.isPending) {
              setArchiving(null);
              void overview.refetch();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("inventory.organization.archiveNamed", {
                  name: archiving.item.name,
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  archiving.kind === "location"
                    ? "inventory.organization.archiveLocationHelp"
                    : "inventory.organization.archiveCategoryHelp",
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {mutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {organizationError(mutation.error, t)}
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
                  loading={mutation.isPending}
                  loadingText={t("equipment.saving")}
                  onClick={() =>
                    archiving.item &&
                    void save(
                      {
                        change: {
                          action:
                            archiving.kind === "location"
                              ? "archive_location"
                              : "archive_label",
                          id: archiving.item.id,
                          expected_version: archiving.item.version,
                        },
                      },
                      () => setArchiving(null),
                    )
                  }
                >
                  {t("inventory.meads.archive")}
                </LoadingButton>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}

function OrganizationEditor({
  editor,
  locations,
  busy,
  error,
  onClose,
  onSave,
}: {
  editor: Editor;
  locations: InventoryLocation[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (command: OrganizationCommand) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(editor.item?.name ?? "");
  const [parent, setParent] = useState(
    editor.kind === "location" ? (editor.item?.parent_id ?? "none") : "none",
  );
  const [query, setQuery] = useState<string | null>(null);
  const choices = [
    { id: "none", name: t("inventory.organization.noParent") },
    ...locations
      .filter((location) => {
        let current: InventoryLocation | undefined = location;
        while (current) {
          if (current.id === editor.item?.id) return false;
          current = locations.find((row) => row.id === current?.parent_id);
        }
        return true;
      })
      .map((location) => ({ id: location.id, name: location.path })),
  ];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !name.trim() ||
      (editor.kind === "location" &&
        !choices.some((item) => item.id === parent))
    )
      return;
    if (editor.kind === "label")
      await onSave({
        change: editor.item
          ? {
              action: "edit_label",
              id: editor.item.id,
              expected_version: editor.item.version,
              name: name.trim(),
            }
          : { action: "create_label", name: name.trim() },
      });
    else
      await onSave({
        change: editor.item
          ? {
              action: "edit_location",
              id: editor.item.id,
              expected_version: editor.item.version,
              name: name.trim(),
              parent_id: parent === "none" ? null : parent,
            }
          : {
              action: "create_location",
              name: name.trim(),
              parent_id: parent === "none" ? null : parent,
            },
      });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              editor.item
                ? "inventory.meads.actions.details"
                : `inventory.organization.add_${editor.kind}`,
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              editor.kind === "location"
                ? "inventory.organization.locationHelp"
                : "inventory.organization.categoryHelp",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>{t("inventory.name")}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              disabled={busy}
            />
          </div>
          {editor.kind === "location" ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-parent`}>
                {t("inventory.organization.parent")}
              </Label>
              <SearchableInput
                openOnFocus={false}
                id={`${id}-parent`}
                items={choices}
                query={query ?? parent}
                keyName="name"
                getValue={(item) => item.id}
                setQuery={(value) => {
                  setQuery(value);
                  setParent("");
                }}
                onSelect={(item) => {
                  setParent(item.id);
                  setQuery(null);
                }}
                disabled={busy}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
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
              disabled={editor.kind === "location" && !parent}
              loadingText={t("equipment.saving")}
            >
              {t("inventory.meads.save")}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
