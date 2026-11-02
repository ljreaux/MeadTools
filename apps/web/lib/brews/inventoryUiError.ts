import type { TFunction } from "i18next";
import { toast } from "@/hooks/use-toast";
import { BrewInventoryCancelled } from "./inventorySelection";

/** Cancellation leaves the original form/batch unfinished, without an error toast. */
export function reportBrewInventoryError(error: unknown, t: TFunction) {
  if (error instanceof BrewInventoryCancelled) return;
  const code =
    error && typeof error === "object" && "body" in error
      ? (error.body as { code?: string })?.code
      : error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
  toast({
    description: t(
      `inventory.errors.${code ?? "FAILED"}`,
      t(`equipment.errors.${code ?? "FAILED"}`, t("inventory.saveError")),
    ),
    variant: "destructive",
  });
}
