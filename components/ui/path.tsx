"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PathItemState = "complete" | "current" | "upcoming";

type PathContextValue = {
  currentId: string;
  activeId: string | null;
  setActiveId: (id: string | null) => void;

  // internal order tracking (derived from render order)
  registerId: (id: string) => void;
  unregisterId: (id: string) => void;
  getIndex: (id: string) => number; // -1 if not registered
};

const PathContext = React.createContext<PathContextValue | null>(null);

function usePathContext() {
  const ctx = React.useContext(PathContext);
  if (!ctx) throw new Error("Path components must be used within <Path />");
  return ctx;
}

type PathProps = React.HTMLAttributes<HTMLDivElement> & {
  currentId: string;
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  defaultActiveId?: string | null;
};

const Path = React.forwardRef<HTMLDivElement, PathProps>(
  (
    {
      className,
      currentId,
      activeId,
      onActiveChange,
      defaultActiveId = null,
      ...props
    },
    ref
  ) => {
    const [internalActive, setInternalActive] = React.useState<string | null>(
      defaultActiveId
    );

    const isControlled = activeId !== undefined;
    const resolvedActive = isControlled ? activeId! : internalActive;

    const setActiveId = React.useCallback(
      (id: string | null) => {
        if (!isControlled) setInternalActive(id);
        onActiveChange?.(id);
      },
      [isControlled, onActiveChange]
    );

    // Render-order registry for children
    const idsRef = React.useRef<string[]>([]);
    const registerId = React.useCallback((id: string) => {
      const ids = idsRef.current;
      if (!ids.includes(id)) ids.push(id);
    }, []);
    const unregisterId = React.useCallback((id: string) => {
      idsRef.current = idsRef.current.filter((x) => x !== id);
    }, []);
    const getIndex = React.useCallback((id: string) => {
      return idsRef.current.indexOf(id);
    }, []);

    return (
      <PathContext.Provider
        value={{
          currentId,
          activeId: resolvedActive,
          setActiveId,
          registerId,
          unregisterId,
          getIndex
        }}
      >
        <div
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-border bg-card p-4",
            className
          )}
          {...props}
        />
      </PathContext.Provider>
    );
  }
);
Path.displayName = "Path";

const PathHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-wrap items-center justify-between gap-3",
      className
    )}
    {...props}
  />
));
PathHeader.displayName = "PathHeader";

const PathTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm font-medium text-muted-foreground", className)}
    {...props}
  />
));
PathTitle.displayName = "PathTitle";

const PathContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-3", className)} {...props} />
));
PathContent.displayName = "PathContent";

/**
 * Connected “button group” layout (no chevrons).
 * Container owns border + dividers, items are borderless.
 */
const PathList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border overflow-hidden",
      "bg-border p-px",
      "flex items-stretch overflow-x-auto sm:overflow-x-hidden",
      className
    )}
    {...props}
  />
));
PathList.displayName = "PathList";

type PathItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  id: string;
  label: React.ReactNode;
  state?: PathItemState; // optional override
  meta?: React.ReactNode;
  onSelect?: (id: string) => void;
};

const PathItem = React.forwardRef<HTMLButtonElement, PathItemProps>(
  (props, ref) => {
    const { className, id, label, meta, state, onSelect, ...buttonProps } =
      props;

    const {
      currentId,
      activeId,
      setActiveId,
      registerId,
      unregisterId,
      getIndex
    } = usePathContext();

    // register this item in render order (no manual order prop)
    React.useEffect(() => {
      registerId(id);
      return () => unregisterId(id);
    }, [id, registerId, unregisterId]);

    const resolvedState: PathItemState =
      state ?? (id === currentId ? "current" : "upcoming");

    const isActive = activeId === id;

    const myIndex = getIndex(id);
    const currentIndex = getIndex(currentId);

    const isBefore =
      myIndex !== -1 && currentIndex !== -1 ? myIndex < currentIndex : false;
    const isAfter =
      myIndex !== -1 && currentIndex !== -1 ? myIndex > currentIndex : false;

    const handleClick = () => {
      const next = isActive ? null : id;
      setActiveId(next);
      onSelect?.(id);
    };

    return (
      <button
        ref={ref}
        type="button"
        data-state={resolvedState}
        data-active={isActive ? "true" : "false"}
        onClick={handleClick}
        className={cn(
          "relative isolate px-4 py-2 text-center transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // sizes
          "shrink-0 min-w-[9.5rem]",
          "sm:shrink sm:flex-1 sm:min-w-0",

          // base fill (items paint over the divider background)
          "bg-card",

          // ---- Behavior-driven fills ----
          // left of current (completed): visually distinct & readable
          isBefore && "bg-muted/60 text-foreground/80",

          // right of current (upcoming): “background color” pill like tabs (this is what you asked)
          isAfter && "bg-background text-foreground",

          // current stage: “selected state” (strong pill)
          "data-[state=current]:bg-primary data-[state=current]:text-primary-foreground",

          // selected/open panel: “background color with border”
          "data-[active=true]:bg-background data-[active=true]:text-foreground",
          "data-[active=true]:z-10 data-[active=true]:shadow-[inset_0_0_0_2px_hsl(var(--ring))]",

          // if you click the current stage, keep it as current (strong), but still show the ring
          "data-[active=true]:data-[state=current]:bg-primary data-[active=true]:data-[state=current]:text-primary-foreground",

          // hover
          "hover:bg-accent hover:text-accent-foreground",

          className
        )}
        {...buttonProps}
      >
        <div className="text-sm font-medium leading-tight line-clamp-1">
          {label}
        </div>

        {meta ? (
          <div
            className={cn(
              "text-xs mt-1 line-clamp-1",
              isBefore ? "text-muted-foreground" : "opacity-80"
            )}
          >
            {meta}
          </div>
        ) : null}
      </button>
    );
  }
);
PathItem.displayName = "PathItem";

type PathPanelProps = React.HTMLAttributes<HTMLDivElement> & { id: string };

const PathPanel = React.forwardRef<HTMLDivElement, PathPanelProps>(
  ({ className, id, ...props }, ref) => {
    const { activeId } = usePathContext();
    const open = activeId === id;

    return (
      <div
        ref={ref}
        data-open={open ? "true" : "false"}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-background",
          "transition-[max-height,opacity] duration-200",
          open
            ? "max-h-[600px] opacity-100"
            : "max-h-0 opacity-0 border-transparent",
          className
        )}
        {...props}
      />
    );
  }
);
PathPanel.displayName = "PathPanel";

const PathActivePanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    render: (activeId: string) => React.ReactNode;
  }
>(({ className, render, ...props }, ref) => {
  const { activeId } = usePathContext();
  if (!activeId) return null;

  return (
    <div
      ref={ref}
      className={cn("rounded-lg border border-border bg-background", className)}
      {...props}
    >
      {render(activeId)}
    </div>
  );
});
PathActivePanel.displayName = "PathActivePanel";

const PathActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
));
PathActions.displayName = "PathActions";

export {
  Path,
  PathHeader,
  PathTitle,
  PathContent,
  PathList,
  PathItem,
  PathPanel,
  PathActivePanel,
  PathActions
};
