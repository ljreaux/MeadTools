"use client";

import { useRef, type ComponentProps } from "react";
import { DialogContent } from "@/components/ui/dialog";
import { AlertDialogContent } from "@/components/ui/alert-dialog";

/** Inventory dialogs are mounted on demand without a Radix DialogTrigger. */
function useInventoryDialogFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: Pick<ComponentProps<typeof DialogContent>, "onOpenAutoFocus" | "onCloseAutoFocus">) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      // Capture before focus enters the dialog, and retain it through effect replays.
      if (!opener.current && document.activeElement instanceof HTMLElement) {
        opener.current = document.activeElement;
      }
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && opener.current?.isConnected) {
        event.preventDefault();
        opener.current.focus();
      }
    },
  };
}

export function InventoryDialogContent(props: ComponentProps<typeof DialogContent>) {
  const focus = useInventoryDialogFocus(props);
  return <DialogContent {...props} {...focus} />;
}

export function InventoryAlertDialogContent(props: ComponentProps<typeof AlertDialogContent>) {
  const focus = useInventoryDialogFocus(props);
  return <AlertDialogContent {...props} {...focus} />;
}
