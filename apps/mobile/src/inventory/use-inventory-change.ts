import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";

import { useSession } from "@/providers/app-providers";

const reloadCodes = new Set(["STALE_STOCK", "ORGANIZATION_CHANGED", "STOCK_ARCHIVED", "NOT_FOUND", "PREMIUM_REQUIRED", "OPERATION_CONFLICT"]);

export function useInventoryChange(errorGroup: "meads" | "organization") {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { t } = useTranslation();
  const pending = useRef<(() => Promise<unknown>) | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [retryOnly, setRetryOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clear() {
    pending.current = null;
    setRetryOnly(false);
    setError(null);
  }

  function reload() {
    void Promise.all(["inventory", "inventory-stock", "finished-meads", "finished-mead", "inventory-organization", "inventory-storage"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key, session?.id] })));
  }

  async function save(
    request: (() => Promise<unknown>) | null,
    onSaved: () => void,
    onStale: () => void
  ) {
    const operation = pending.current ?? request;
    if (saving.current || !operation) return;
    saving.current = true;
    pending.current = operation;
    setBusy(true);
    setError(null);

    try {
      await operation();
      clear();
      reload();
      onSaved();
    } catch (failure) {
      if (failure instanceof MeadToolsApiError && failure.status >= 400 && failure.status < 500) {
        clear();
        const body = failure.body;
        const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : "";
        if (reloadCodes.has(code)) {
          onStale();
          reload();
        }
        setError(t(`inventory.${errorGroup}.errors.${code}`, {
          defaultValue: t(`inventory.errors.${code}`, { defaultValue: t("inventory.saveError") })
        }));
      } else {
        setRetryOnly(true);
        setError(t("mobileInventory.retrySame"));
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return { busy, retryOnly, error, clear, save };
}
