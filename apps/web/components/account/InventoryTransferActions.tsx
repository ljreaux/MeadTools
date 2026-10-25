"use client";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { inventoryTransferResponseSchema } from "@meadtools/api-contract/inventory";
import type {
  InventoryStockItem,
  InventoryTransferRequestBody,
} from "@meadtools/api-contract/contracts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { InventoryImportDialog } from "./InventoryImportDialog";
import { toast } from "@/hooks/use-toast";

export function downloadTransferFile(file: {
  content: string;
  media_type: string;
  filename: string;
}) {
  const bytes = Uint8Array.from(atob(file.content), (char) =>
    char.charCodeAt(0),
  );
  const url = URL.createObjectURL(new Blob([bytes], { type: file.media_type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function transferErrorCode(error: unknown) {
  return error && typeof error === "object" && "body" in error
    ? (error.body as { code?: string })?.code
    : undefined;
}
export function InventoryTransferActions({
  canManage,
  stock,
}: {
  canManage: boolean;
  stock: InventoryStockItem[];
}) {
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const importButton = useRef<HTMLButtonElement>(null);
  function closeImport() {
    setOpen(false);
    requestAnimationFrame(() => importButton.current?.focus());
  }
  async function request(body: InventoryTransferRequestBody) {
    try {
      return inventoryTransferResponseSchema.parse(
        await fetchWithAuth("/api/account/inventory/transfer", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    } catch (error) {
      if (body.action !== "export")
        void client.invalidateQueries({ queryKey: ["account", "inventory"] });
      throw error;
    }
  }
  async function download(format: "xlsx" | "csv", template = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await request({ action: "export", format, template });
      if (result.kind !== "file") throw new Error();
      downloadTransferFile(result);
    } catch (error) {
      toast({
        variant: "destructive",
        description: t(
          `inventory.transfer.errors.${transferErrorCode(error) ?? "FAILED"}`,
          t("inventory.transfer.errors.FAILED"),
        ),
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {canManage ? (
        <Button
          ref={importButton}
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <Upload aria-hidden className="h-4 w-4" />
          {t("inventory.transfer.import")}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy}>
            <Download aria-hidden className="h-4 w-4" />
            {t(
              busy
                ? "inventory.transfer.preparing"
                : "inventory.transfer.export",
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void download("xlsx")}>
            {t("inventory.transfer.excel")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void download("csv")}>
            {t("inventory.transfer.csv")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void download("xlsx", true)}>
            {t("inventory.transfer.template")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open && canManage ? (
        <InventoryImportDialog
          stock={stock}
          request={request}
          onClose={closeImport}
          onImported={() => {
            closeImport();
            void client.invalidateQueries({
              queryKey: ["account", "inventory"],
            });
          }}
        />
      ) : null}
    </>
  );
}
