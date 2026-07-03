"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type PagedResultsProps = {
  className?: string;

  /** Top controls: search/sort/filters/etc */
  controls?: React.ReactNode;

  /** The list/grid/table itself */
  children: React.ReactNode;

  /** Footer area: showing text, per-page select, pagination, etc */
  footer?: React.ReactNode;

  /**
   * Optional “panel” mode: keeps footer pinned by making the list scroll.
   * Recommend enabling only on sm+ if you ever use it.
   */
  scroll?: boolean;
  scrollClassName?: string; // e.g. "sm:max-h-[60vh]"
};

export function PagedResults({
  className,
  controls,
  children,
  footer,
  scroll = false,
  scrollClassName
}: PagedResultsProps) {
  return (
    <section className={cn("w-full flex flex-col gap-4", className)}>
      {controls ? <div className="w-full">{controls}</div> : null}

      {scroll ? (
        <div
          className={cn(
            "w-full overflow-y-auto",
            scrollClassName ?? "sm:max-h-[60vh]"
          )}
        >
          {children}
        </div>
      ) : (
        <div className="w-full">{children}</div>
      )}

      {footer ? <div className="w-full">{footer}</div> : null}
    </section>
  );
}
