"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Beer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { useRecipe } from "@/components/providers/SavedRecipeProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Spinner } from "../ui/spinner";
import { toast } from "@/hooks/use-toast";
import { useRateRecipeMutation } from "@/hooks/useRecipeQuery";
import { useAuth } from "@/hooks/useAuth";

type RatingPickerProps = {
  value: number; // 0..5
  onChange: (v: number) => void;
  size?: number;
  animateMs?: number;
};

function RatingPicker({
  value,
  onChange,
  size = 20,
  animateMs = 180
}: RatingPickerProps) {
  const [hover, setHover] = useState<number | null>(null);

  const display = hover ?? value;

  const fills = useMemo(() => {
    const safe = Math.min(Math.max(display, 0), 5);
    return Array.from({ length: 5 }, (_, i) => {
      const diff = safe - i;
      return diff >= 1 ? 1 : 0;
    });
  }, [display]);

  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    lineHeight: 0
  };
  const VISUAL_COMP = 1.15;

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
            <Beer className="absolute inset-0 text-border" strokeWidth={1.5} />
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
  const { ratingStats, setRatingStats } = useRecipe();
  const { isLoggedIn } = useAuth();
  const params = useParams();
  const recipeId = Number(params.id);

  // userRating from provider is the canonical value
  const userRating = ratingStats?.userRating ?? 0;

  // local draft value while the popover is open
  const [draftRating, setDraftRating] = useState<number>(userRating);
  const [open, setOpen] = useState(false);

  const rateMutation = useRateRecipeMutation();
  const isLoading = rateMutation.isPending;

  // When the popover opens, initialize the draft from the current userRating
  useEffect(() => {
    if (open) {
      setDraftRating(userRating);
    }
  }, [open, userRating]);

  const handleClick = () => {
    if (!recipeId || draftRating < 1) return;

    rateMutation.mutate(
      { recipeId, rating: draftRating },
      {
        onSuccess: (data) => {
          // assuming API returns { rating: { averageRating, numberOfRatings, userRating } }
          setRatingStats?.((prev) => ({
            ...prev,
            ...(data as any).rating
          }));

          toast({
            description: `Thanks for your ${draftRating} mug rating.`
          });
          setOpen(false);
        },
        onError: () => {
          toast({
            description: "Something went wrong",
            variant: "destructive"
          });
        }
      }
    );
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
            <RatingPicker
              value={draftRating}
              onChange={setDraftRating}
              size={22}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClick}
              disabled={draftRating < 1 || isLoading}
            >
              {isLoading ? <Spinner /> : "Save"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
