"use client";

import * as React from "react";
import {
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon
} from "lucide-react";
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
  closing?: boolean; // used for exit animation
};

type BannerContextValue = {
  banners: BannerItem[];
  showBanner: (input: BannerInput) => string;
  requestDismiss: (id: string) => void;
  dismissBanner: (id: string) => void; // hard remove (rarely needed directly)
  clearBanners: () => void;
};

const BannerContext = React.createContext<BannerContextValue | null>(null);

const EXIT_MS = 180;

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = React.useState<BannerItem[]>([]);

  // timers:
  // - autoDismiss: when duration hits, we requestDismiss (animate out)
  // - finalize: after EXIT_MS, we actually remove from state
  const autoDismissTimers = React.useRef(new Map<string, number>());
  const finalizeTimers = React.useRef(new Map<string, number>());

  const clearAllTimersFor = React.useCallback((bannerId: string) => {
    const a = autoDismissTimers.current.get(bannerId);
    if (a) window.clearTimeout(a);
    autoDismissTimers.current.delete(bannerId);

    const f = finalizeTimers.current.get(bannerId);
    if (f) window.clearTimeout(f);
    finalizeTimers.current.delete(bannerId);
  }, []);

  const dismissBanner = React.useCallback(
    (bannerId: string) => {
      setBanners((prev) => prev.filter((b) => b.id !== bannerId));
      clearAllTimersFor(bannerId);
    },
    [clearAllTimersFor]
  );

  const requestDismiss = React.useCallback(
    (bannerId: string) => {
      // mark as closing (idempotent)
      setBanners((prev) =>
        prev.map((b) => (b.id === bannerId ? { ...b, closing: true } : b))
      );

      // finalize removal after exit animation
      if (!finalizeTimers.current.has(bannerId)) {
        const t = window.setTimeout(() => dismissBanner(bannerId), EXIT_MS);
        finalizeTimers.current.set(bannerId, t);
      }

      // if it was going to auto-dismiss later, cancel that (we're dismissing now)
      const a = autoDismissTimers.current.get(bannerId);
      if (a) window.clearTimeout(a);
      autoDismissTimers.current.delete(bannerId);
    },
    [dismissBanner]
  );

  const clearBanners = React.useCallback(() => {
    setBanners([]);
    autoDismissTimers.current.forEach((t) => window.clearTimeout(t));
    finalizeTimers.current.forEach((t) => window.clearTimeout(t));
    autoDismissTimers.current.clear();
    finalizeTimers.current.clear();
  }, []);

  const showBanner = React.useCallback(
    (input: BannerInput) => {
      const bannerId = id();
      const item: BannerItem = {
        id: bannerId,
        createdAt: Date.now(),
        variant: input.variant ?? "default",
        dismissible: input.dismissible ?? true,
        closing: false,
        ...input
      };

      setBanners((prev) => [item, ...prev]);

      const duration = input.duration ?? 0;
      if (duration > 0) {
        const t = window.setTimeout(() => requestDismiss(bannerId), duration);
        autoDismissTimers.current.set(bannerId, t);
      }

      return bannerId;
    },
    [requestDismiss]
  );

  // cleanup on unmount
  React.useEffect(() => {
    return () => {
      autoDismissTimers.current.forEach((t) => window.clearTimeout(t));
      finalizeTimers.current.forEach((t) => window.clearTimeout(t));
      autoDismissTimers.current.clear();
      finalizeTimers.current.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({
      banners,
      showBanner,
      requestDismiss,
      dismissBanner,
      clearBanners
    }),
    [banners, showBanner, requestDismiss, dismissBanner, clearBanners]
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

export function BannerStack({
  className,
  max,
  containerClassName
}: {
  className?: string;
  containerClassName?: string;
  max?: number;
}) {
  const { banners, requestDismiss } = useBanner();
  const visible = typeof max === "number" ? banners.slice(0, max) : banners;

  if (visible.length === 0) return null;

  return (
    <div className={cn("w-full", containerClassName)}>
      <div className="w-full flex flex-col gap-0">
        {visible.map((b) => (
          <Banner
            key={b.id}
            banner={b}
            onDismiss={() => requestDismiss(b.id)}
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
    warning: "bg-warning text-foreground border-foreground/20"
  };

  const iconMap: Record<BannerVariant, React.ReactNode> = {
    default: <Info className="h-4 w-4" />,
    destructive: <AlertOctagon className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />
  };

  // enter animation: start "not entered", then flip true on next frame
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const isExiting = banner.closing === true;

  return (
    <div
      role="status"
      className={cn(
        "w-full relative px-4 py-3 flex flex-col gap-2 border-y rounded-none z-[2000]",
        variantClasses[variant],

        // animation
        "transition-all duration-200 will-change-transform",
        !entered ? "opacity-0 -translate-y-2" : "",
        entered && !isExiting ? "opacity-100 translate-y-0" : "",
        isExiting ? "opacity-0 -translate-y-2" : "",

        className
      )}
    >
      {/* Dismiss (top-right) */}
      {banner.dismissible !== false ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}

      {/* Scrollable content */}
      <div
        className={cn(
          "min-w-0 max-h-[30vh] sm:max-h-[22vh] overflow-y-auto pr-6",
          "scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted-foreground/40"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="mt-[2px] shrink-0">{iconMap[variant]}</div>

          <div className="min-w-0 flex-1">
            {banner.title ? (
              <div className="text-sm font-medium leading-5">
                {banner.title}
              </div>
            ) : null}

            {banner.description ? (
              <div
                className={cn("text-sm opacity-90", banner.title ? "mt-1" : "")}
              >
                {banner.description}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom action row */}
      {banner.action ? (
        <div className="pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => banner.action?.onClick()}
            className={cn(
              variant === "destructive" ? "bg-background text-foreground" : ""
            )}
          >
            {banner.action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
