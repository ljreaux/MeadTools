"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type BannerVariant = "default" | "destructive" | "success" | "warning";

type BannerAction = {
  label: string;
  onClick: () => void;
};

export type BannerInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;

  variant?: BannerVariant;
  action?: BannerAction;

  /** auto-dismiss in ms; omit/0 to never auto-dismiss */
  duration?: number;

  /** defaults to true */
  dismissible?: boolean;
};

type BannerItem = BannerInput & {
  id: string;
  createdAt: number;
};

type BannerContextValue = {
  banners: BannerItem[];
  showBanner: (input: BannerInput) => string;
  dismissBanner: (id: string) => void;
  clearBanners: () => void;
};

const BannerContext = React.createContext<BannerContextValue | null>(null);

function id() {
  // stable enough for UI
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = React.useState<BannerItem[]>([]);
  const timers = React.useRef(new Map<string, number>());

  const dismissBanner = React.useCallback((bannerId: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== bannerId));
    const t = timers.current.get(bannerId);
    if (t) window.clearTimeout(t);
    timers.current.delete(bannerId);
  }, []);

  const clearBanners = React.useCallback(() => {
    setBanners([]);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
  }, []);

  const showBanner = React.useCallback(
    (input: BannerInput) => {
      const bannerId = id();
      const item: BannerItem = {
        id: bannerId,
        createdAt: Date.now(),
        variant: input.variant ?? "default",
        dismissible: input.dismissible ?? true,
        ...input
      };

      setBanners((prev) => [item, ...prev]);

      const duration = input.duration ?? 0;
      if (duration > 0) {
        const timeout = window.setTimeout(
          () => dismissBanner(bannerId),
          duration
        );
        timers.current.set(bannerId, timeout);
      }

      return bannerId;
    },
    [dismissBanner]
  );

  // cleanup on unmount
  React.useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({ banners, showBanner, dismissBanner, clearBanners }),
    [banners, showBanner, dismissBanner, clearBanners]
  );

  return (
    <BannerContext.Provider value={value}>{children}</BannerContext.Provider>
  );
}

export function useBanner() {
  const ctx = React.useContext(BannerContext);
  if (!ctx) throw new Error("useBanner must be used inside <BannerProvider />");
  return ctx;
}

/**
 * Place this wherever you want vertically.
 * - Full width by default
 * - Not fixed / not positioned: you control placement with parent layout
 *
 * Example placement:
 *   <div className="sticky top-24 z-50">
 *     <BannerStack />
 *   </div>
 */
export function BannerStack({
  className,
  max,
  containerClassName
}: {
  className?: string; // per-banner wrapper classes (rare)
  containerClassName?: string; // stack wrapper classes
  max?: number; // max banners to render
}) {
  const { banners, dismissBanner } = useBanner();
  const visible = typeof max === "number" ? banners.slice(0, max) : banners;

  if (visible.length === 0) return null;

  return (
    <div className={cn("w-full", containerClassName)}>
      <div className="w-full flex flex-col gap-0">
        {visible.map((b) => (
          <Banner
            key={b.id}
            banner={b}
            onDismiss={() => dismissBanner(b.id)}
            className={className}
          />
        ))}
      </div>
    </div>
  );
}

function Banner({
  banner,
  onDismiss,
  className
}: {
  banner: BannerItem;
  onDismiss: () => void;
  className?: string;
}) {
  const variant = banner.variant ?? "default";
  const variantClasses: Record<BannerVariant, string> = {
    default: "bg-background text-foreground border-foreground/20",
    destructive:
      "bg-destructive text-destructive-foreground border-destructive/40",
    success: "bg-foreground text-background border-foreground/20",
    warning: "bg-secondary text-foreground border-foreground/20"
  };

  return (
    <div
      role="status"
      className={cn(
        "w-full",
        "px-4 py-2",
        "flex items-center gap-3",
        "rounded-none",
        "border-y",
        "z-[2000]",
        variantClasses[variant],
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {banner.title ? (
          <div className="text-sm font-medium leading-5 truncate">
            {banner.title}
          </div>
        ) : null}
        {banner.description ? (
          <div
            className={cn("text-sm opacity-90", banner.title ? "mt-0.5" : "")}
          >
            {banner.description}
          </div>
        ) : null}
      </div>

      {banner.action ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            banner.action?.onClick();
          }}
          className={cn(
            "shrink-0",
            // keep secondary looking like your site (your secondary is bg-background)
            variant === "destructive" ? "bg-background text-foreground" : ""
          )}
        >
          {banner.action.label}
        </Button>
      ) : null}

      {banner.dismissible !== false ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 mr-4"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
