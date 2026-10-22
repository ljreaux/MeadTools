# Design themes

Themes combine the existing shadcn/Tailwind color variables with the
contributor's decorative component styles. `next-themes` controls light/dark/
system through the `dark` class; `data-design` on `html` selects the design.
These are independent preferences.

Use the navbar palette menu to select and remember a design and its light/dark/
system mode. The separate mode toggle is removed; account settings use the same
menu. Classic uses the shared design tokens. The server renders Classic by
default. A minimal script only reads and validates the saved design before paint;
blocked storage or unknown ids leave Classic unchanged. It does not parse URLs,
write preferences, or manage mode. `next-themes` continues to own mode.

## Where integration belongs

- Theme colors, fonts, radii, shadows, and page canvases use CSS variables.
  `app/globals.css` supplies Classic defaults and `tailwind.config.ts` exposes
  them through normal semantic utilities.
- Distinctive artwork lives in `app/themes/<id>.css`: gradients, glow, textures,
  decorative borders, hexagonal icon surfaces, and interaction effects.
- Shared UI primitives expose stable `data-slot` hooks. The hooks belong in the
  primitives, not in every component or page that uses them. A new screen built
  from `Button`, `Card`, `Input`, etc. inherits their complete styling.
- The shared navbar, footer, and calculator sidebars expose their own hooks.
- Page surfaces already use `bg-background` with `rounded-xl` or `rounded-2xl`.
  Theme selectors use `:where(.bg-background:is(.rounded-xl, .rounded-2xl))`
  for those surfaces. No `PagePanel` wrapper
  or page-specific data attributes are required. Keep that pairing on a surface
  that should receive the page-panel treatment.

An entirely new primitive inherits semantic colors and tokens immediately.
Only a deliberately bespoke treatment requires adding a shared hook and theme
rules. Do not add hooks to arbitrary feature components or annotate their
individual uses.

Buttons use the classes emitted by `buttonVariants()`: `mt-button`,
`mt-button--<variant>`, and `mt-button-size--<size>`. This also gives links styled
with the helper the same artwork as `Button`, without adding attributes at each
call site. Keep variant and size markers separate.

## Keep layout shared

Theme rules may change appearance, but not content padding, margins, gaps,
widths, heights, font sizes, line heights, or letter spacing. Those stay in the
shared component/page classes so that switching themes does not select a
different density or responsive layout. Keep focus indicators visible.

Pseudo-elements may have their own geometry to draw the contributor's artwork;
that geometry must not resize the content container. Font families and weights
can still change wrapping, so check narrow screens and long labels. Avoid tying
theme selectors to spacing classes such as `p-8` or `md:p-12`.

Shared button groups own joined corners and borders. Their children suppress
individual shadows and transforms so theme interaction effects do not separate
segments. Hive keeps its hexagonal treatment on standalone icon buttons.
Text buttons can grow vertically and wrap long labels; icon buttons retain their
fixed size. Dense tables keep button labels on one line inside their scrolling
container. Cards use `min-w-0` so those containers also shrink inside grids.
Tabs wrap, PDF toolbar groups can stack, and the shared banner region reserves
its measured height above page content.

Calculator sidebar toggles live in fixed-width shells outside the collapsible
surface, so hiding the navigation cannot shrink the toggle. Keep fixed sidebars
outside decorated page panels: Neon backdrop blur creates a containing block
that would otherwise anchor fixed descendants to the panel. Account action
headers wrap in normal document flow on mobile and remain positioned on desktop.

See [the theme audit](theme-audit.md) for browser coverage and remaining limits.

## Adding or editing a design

1. Define light and dark semantic colors in `app/themes/<id>.css`. Prefer
   variables and the existing shared hooks; add custom art only where needed.
2. Import the CSS from `app/globals.css`. Keep imported files as plain CSS
   without `@layer`: Turbopack processes them separately with Tailwind v3.
3. Register the id in `lib/design-themes.ts` and add its English label under
   `accountPage.designTheme` in `packages/i18n/locales/en/default.json`.
   Weblate supplies German separately; follow [the translation workflow](translation-workflow.md).
4. Expose any new fonts through `next/font` variables in `app/layout.tsx` with
   `preload: false` for additional theme fonts.
5. Run the theme contract tests, and compare both modes with Classic at narrow
   and desktop widths. New screens using existing primitives need no theme work.

To remove a design, reverse those steps and remove fonts no other theme uses.
