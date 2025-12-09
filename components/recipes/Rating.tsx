import { useEffect, useMemo, useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from "@/components/ui/tooltip";
import { Beer } from "lucide-react";

type RatingProps = {
  averageRating: number;
  numberOfRatings: number;
  /** set false to render without the mount animation */
  animate?: boolean;
};

export default function Rating({
  averageRating = 0,
  numberOfRatings = 0,
  animate = true
}: RatingProps) {
  const [mounted, setMounted] = useState(false);

  // Respect reduced motion and avoid hydration flicker
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!animate || prefersReduced) {
      setMounted(true); // immediately show final widths
      return;
    }

    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  // Clamp rating between 0–5
  const safeAverage = Math.min(Math.max(averageRating, 0), 5);

  // Per-icon fill levels (0–1)
  const fills = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = safeAverage - i;
        return d >= 1 ? 1 : d > 0 ? d : 0;
      }),
    [safeAverage]
  );

  // Horizontal overshoot so “full” visually looks full with Lucide padding
  const VISUAL_COMP = 1.15;
  const TRANSITION_MS = animate ? 1000 : 0;

  const tooltipLabel =
    numberOfRatings === 0
      ? "No ratings yet"
      : `Average ${safeAverage.toFixed(1)} out of 5 from ${numberOfRatings} ${
          numberOfRatings === 1 ? "rating" : "ratings"
        }`;

  // No-ratings UI (icons only, tooltip carries the text)
  if (numberOfRatings === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex w-fit shrink-0"
            role="img"
            aria-label={tooltipLabel}
          >
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative sm:w-5 sm:h-5 h-3 w-3">
                  <Beer
                    className="absolute text-border sm:w-5 sm:h-5 h-3 w-3"
                    strokeWidth={1.5}
                  />
                </div>
              ))}
            </div>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="!w-auto">
          <p>{tooltipLabel}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Normal UI (icons only, tooltip carries the text)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex w-fit shrink-0"
          role="img"
          aria-label={tooltipLabel}
        >
          <div className="flex gap-0.5">
            {fills.map((targetFill, i) => (
              <div key={i} className="relative sm:w-5 sm:h-5 h-3 w-3">
                {/* Base (muted) mug */}
                <Beer
                  className="absolute text-border sm:w-5 sm:h-5 h-3 w-3"
                  strokeWidth={1.5}
                />
                {/* Animated fill overlay */}
                <div
                  className="absolute overflow-hidden text-accent-foreground transition-[width] ease-in-out"
                  style={{
                    width: mounted
                      ? `${targetFill * 100 * VISUAL_COMP}%`
                      : "0%",
                    transitionDuration: `${TRANSITION_MS}ms`
                  }}
                >
                  <Beer
                    className="text-accent-foreground sm:w-5 sm:h-5 h-3 w-3"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="!w-auto">
        <p>{tooltipLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
