"use client";

import { useState, useMemo, useCallback } from "react";
import { Beer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRecipe } from "@/components/providers/SavedRecipeProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Spinner } from "../ui/spinner";
import { toast } from "@/hooks/use-toast";

type RatingPickerProps = {
  value: number; // 0..5
  onChange: (v: number) => void; // commit selected rating
  size?: number; // px for each mug (default 20)
  animateMs?: number; // width animation duration
};

function RatingPicker({
  value,
  onChange,
  size = 20,
  animateMs = 180
}: RatingPickerProps) {
  const [hover, setHover] = useState<number | null>(null);

  // what we visually show (hover preview wins)
  const display = hover ?? value;

  const fills = useMemo(() => {
    const safe = Math.min(Math.max(display, 0), 5);
    return Array.from({ length: 5 }, (_, i) => {
      // integer selection: 0 or 1 per mug (full mugs up to display)
      const diff = safe - i;
      return diff >= 1 ? 1 : 0;
    });
  }, [display]);

  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    lineHeight: 0
  };
  const VISUAL_COMP = 1.15; // same horizontal overshoot as your display Rating

  const commit = useCallback((n: number) => onChange(n), [onChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      commit(Math.min(5, (value || 0) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      commit(Math.max(0, (value || 0) - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(5);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Rate this recipe from 1 to 5"
      className="inline-flex w-fit items-center gap-1"
      onKeyDown={onKeyDown}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const index = i + 1;
        const selected = value === index;

        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${index} ${index === 1 ? "mug" : "mugs"}`}
            className={[
              "relative inline-flex items-center justify-center rounded-sm outline-none",
              "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring focus-visible:ring-offset-background",
              "cursor-pointer"
            ].join(" ")}
            style={boxStyle}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(null)}
            onClick={() => commit(index)}
          >
            {/* Base (unfilled) — border gray to match cards */}
            <Beer className="absolute inset-0 text-border" strokeWidth={1.5} />

            {/* Filled overlay — same style as your Rating component */}
            <span
              className="absolute inset-y-0 left-0 overflow-hidden transition-[width] ease-in-out pointer-events-none"
              style={{
                width: `${fills[i]! * 100 * VISUAL_COMP}%`,
                transitionDuration: `${animateMs}ms`
              }}
            >
              <Beer
                className="absolute inset-0 text-accent-foreground"
                strokeWidth={1.5}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function RateRecipe() {
  const { setRatingStats } = useRecipe(); // available if you need recipe.id later
  const { isLoggedIn, fetchAuthenticatedPost } = useAuth();
  const [rating, setRating] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const params = useParams();
  const recipeId = Number(params.id); // convert from string

  const handleClick = async () => {
    try {
      setLoading(true);

      const res = await fetchAuthenticatedPost(
        `/api/recipes/${recipeId}/ratings`,
        { rating }
      );
      setRatingStats?.(res.rating);

      toast({
        description: `Thanks for your ${rating} mug rating.`
      });
    } catch {
      toast({
        description: "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setOpen(false);
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-fit">Leave a rating</button>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        {!isLoggedIn ? (
          <div className="flex items-center">
            <Link href="/login">Log in to leave a rating.</Link>
          </div>
        ) : (
          <div className="grid items-center gap-3">
            <RatingPicker value={rating} onChange={setRating} size={22} />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClick}
              disabled={rating < 1}
            >
              {loading ? <Spinner /> : "Save"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
