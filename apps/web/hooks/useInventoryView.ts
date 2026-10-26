"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  defaultInventoryView,
  inventoryViewSchema,
  type InventoryView,
} from "@meadtools/inventory-domain";
import { useAuth } from "@/hooks/auth/useAuth";
const initial = JSON.stringify(defaultInventoryView);
const fallback = new Map<string, string>();
const eventName = "meadtools-inventory-view";

/** Versioned, account-scoped browser preferences; no stock or credentials are stored. */
export function useInventoryView(scope: "consumables" | "meads") {
  const { user } = useAuth();
  const key = `meadtools:inventory-view:v1:${user?.id ?? "signed-out"}:${scope}`;
  const read = useCallback(() => {
    if (fallback.has(key)) return fallback.get(key)!;
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  }, [key]);
  const subscribe = useCallback(
    (callback: () => void) => {
      const changed = () => callback();
      const external = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          fallback.delete(key);
          callback();
        }
      };
      window.addEventListener(eventName, changed);
      window.addEventListener("storage", external);
      return () => {
        window.removeEventListener(eventName, changed);
        window.removeEventListener("storage", external);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(subscribe, read, () => initial);
  const view = useMemo(() => {
    try {
      return inventoryViewSchema.parse(JSON.parse(raw));
    } catch {
      return structuredClone(defaultInventoryView);
    }
  }, [raw]);
  const setView = useCallback(
    (next: InventoryView) => {
      const serialized = JSON.stringify(inventoryViewSchema.parse(next));
      try {
        localStorage.setItem(key, serialized);
        fallback.delete(key);
      } catch {
        fallback.set(key, serialized);
      }
      window.dispatchEvent(new Event(eventName));
    },
    [key],
  );
  return [view, setView] as const;
}
