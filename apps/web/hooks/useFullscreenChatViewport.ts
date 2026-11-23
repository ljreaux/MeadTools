"use client";

import { type RefObject, useEffect, useState } from "react";
import { visibleViewportBox } from "@/lib/utils/visible-viewport";

/** Matches Tailwind's `max-sm:` variant (below 640px). */
export const PHONE_MEDIA_QUERY = "not all and (min-width: 640px)";

/**
 * Keeps a full-screen chat panel inside the visible area while it is open.
 *
 * Writes `--chat-viewport-top` and `--chat-viewport-height` (in px) onto the
 * element, so its classes can use
 * `top-[var(--chat-viewport-top,0px)] h-[var(--chat-viewport-height,100dvh)]`.
 * The page behind is locked so only the message list scrolls.
 *
 * With `mediaQuery`, it is only active while the query matches.
 */
export function useFullscreenChatViewport(
  ref: RefObject<HTMLElement | null>,
  { enabled, mediaQuery }: { enabled: boolean; mediaQuery?: string },
) {
  const matches = useMediaQueryMatch(enabled ? mediaQuery : undefined);
  const active = enabled && matches;

  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const viewport = window.visualViewport;
    let frame = 0;
    let last = "";
    const apply = () => {
      frame = 0;
      const box = visibleViewportBox(viewport, window.innerHeight);
      const next = `${box.top}:${box.height}`;
      if (next === last) return;
      last = next;
      element.style.setProperty("--chat-viewport-top", `${box.top}px`);
      element.style.setProperty("--chat-viewport-height", `${box.height}px`);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      element.style.removeProperty("--chat-viewport-top");
      element.style.removeProperty("--chat-viewport-height");
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, [active, ref]);

  return active;
}

/** True when there is no query, or while the query matches. */
function useMediaQueryMatch(query: string | undefined): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (!query) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return query ? matches : true;
}
