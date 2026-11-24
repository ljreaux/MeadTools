/** The part of the layout viewport the brewer can actually see. */
export type VisibleViewportBox = { top: number; height: number };

type VisualViewportLike = {
  height: number;
  offsetTop: number;
  scale?: number;
};

/**
 * Where a full-screen, `position: fixed` panel should sit so it fills the
 * visible area above an on-screen keyboard.
 *
 * iOS Safari keeps the layout viewport (and `vh`/`dvh`) full height when the
 * keyboard opens, then scrolls it so the focused field is visible. Android
 * Chrome does the same by default (`interactive-widget=resizes-visual`).
 * The visual viewport is the only measurement that follows the keyboard on
 * both, and its `offsetTop` is how far that scroll moved it.
 *
 * While the page is pinch-zoomed the visual viewport is a magnified window,
 * not the keyboard-free area, so the layout viewport is used instead.
 */
export function visibleViewportBox(
  visualViewport: VisualViewportLike | null | undefined,
  layoutHeight: number,
): VisibleViewportBox {
  const fallback = { top: 0, height: Math.max(0, Math.round(layoutHeight)) };
  if (!visualViewport) return fallback;
  const { height, offsetTop, scale = 1 } = visualViewport;
  if (!Number.isFinite(height) || height <= 0) return fallback;
  if (Number.isFinite(scale) && scale > 1.01) return fallback;
  const top = Number.isFinite(offsetTop) ? Math.max(0, offsetTop) : 0;
  return { top: Math.round(top), height: Math.round(height) };
}
