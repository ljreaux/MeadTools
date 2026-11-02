"use client";

import * as React from "react";
import {
  DEFAULT_DESIGN_THEME,
  DESIGN_THEME_STORAGE_KEY,
  isDesignThemeId,
  type DesignThemeId
} from "@/lib/design-themes";

// The data-design attribute on <html> (set before hydration by
// designThemeInitScript) is the source of truth.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DesignThemeId {
  const current = document.documentElement.getAttribute("data-design");
  return isDesignThemeId(current) ? current : DEFAULT_DESIGN_THEME;
}

function getServerSnapshot(): DesignThemeId {
  return DEFAULT_DESIGN_THEME;
}

function setDesign(next: DesignThemeId) {
  document.documentElement.setAttribute("data-design", next);
  try {
    localStorage.setItem(DESIGN_THEME_STORAGE_KEY, next);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function useDesignTheme() {
  const design = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return { design, setDesign };
}
