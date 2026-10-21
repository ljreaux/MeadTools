import * as React from "react";

import { cn } from "@/lib/utils";

type PagePanelProps<T extends React.ElementType> = {
  /** Element to render, e.g. "form" or "main". Defaults to "div". */
  as?: T;
  /** Drop the panel surface and theme hook, e.g. when the content is embedded elsewhere. */
  bare?: boolean;
} & Omit<React.ComponentPropsWithoutRef<T>, "as">;

/**
 * The rounded content panel each page sits in. Design themes style it through
 * `data-slot="page-panel"` (see docs/design-themes.md); layout classes such as
 * width and padding come from the caller.
 */
export function PagePanel<T extends React.ElementType = "div">({
  as,
  bare,
  className,
  ...props
}: PagePanelProps<T>) {
  const Comp = as ?? "div";
  return (
    <Comp
      data-slot={bare ? undefined : "page-panel"}
      className={cn(!bare && "rounded-xl bg-background", className)}
      {...props}
    />
  );
}
