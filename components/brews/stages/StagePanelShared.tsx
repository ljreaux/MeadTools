"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StatusTile({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-medium", tone === "warn" && "text-yellow-700 dark:text-yellow-300")}>
        {value}
      </div>
    </div>
  );
}

export function WorkRow({
  title,
  detail,
  amount,
  isLogged,
  loggedLabel,
  actionLabel,
  disabled,
  disabledReason,
  onLog
}: {
  title: string;
  detail?: string | null;
  amount?: string | null;
  isLogged: boolean;
  loggedLabel: string;
  actionLabel: string;
  disabled: boolean;
  disabledReason?: string | null;
  onLog: () => Promise<void> | void;
}) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2",
        isLogged && "opacity-70"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight line-clamp-2 whitespace-pre-line">{title}</div>
        {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
        {!isLogged && disabled && disabledReason ? (
          <div className="mt-1 text-xs text-muted-foreground">{disabledReason}</div>
        ) : null}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {amount ? <div className="text-sm text-muted-foreground">{amount}</div> : null}
        {isLogged ? (
          <div className="text-xs text-muted-foreground">{loggedLabel}</div>
        ) : (
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onLog}>
            {actionLabel}
          </Button>
        )}
      </div>
    </li>
  );
}
