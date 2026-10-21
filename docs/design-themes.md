# Design themes

Design themes are full visual redesigns of the web app (colors, fonts, radii,
shadows, component styling). They are independent of light/dark mode: every
theme has a light and a dark variant, and the existing mode toggle still picks
between them.

Users pick a design from the palette button in the navbar. `?design=<id>` in
any URL also selects (and remembers) a design, which is handy for sharing a
preview.

## How it works

| Piece | Location | Role |
| --- | --- | --- |
| Registry | `apps/web/lib/design-themes.ts` | Theme ids, default, storage key, pre-hydration script |
| Init script | `apps/web/app/layout.tsx` | Sets `html[data-design]` from `?design=` or `localStorage` before hydration, so there is no flash |
| Hook | `apps/web/hooks/useDesignTheme.ts` | Reads and changes the active design; the `data-design` attribute is the source of truth |
| Switcher | `apps/web/components/ui/design-theme-switcher.tsx` | Navbar dropdown |
| Styles | `apps/web/app/themes/<id>.css` | One file per theme, imported from `app/globals.css` |
| Labels | `packages/i18n/locales/en/default.json` | `accountPage.designTheme.<id>` |

`classic` is the default and has no CSS file: it is the existing Tailwind and
shadcn styling. An unknown stored or requested id falls back to `classic`, so
removing a theme is safe for users who had it selected.

## Theme CSS

Each theme file is plain CSS (no `@apply` or `@layer`) and scopes every rule
to its id:

- `html[data-design="<id>"]` overrides the shadcn HSL variables
  (`--background`, `--primary`, `--radius`, …) for light mode.
- `html.dark[data-design="<id>"]` does the same for dark mode.
- Component rules target `data-slot` attributes, for example
  `html[data-design="<id>"] [data-slot="button"][data-variant="outline"]`.

Fonts come from `next/font/google` in `app/layout.tsx` and are exposed as CSS
variables such as `--font-fraunces` on `<html>`. They are not preloaded, so a
theme's fonts load only when that theme uses them.

## `data-slot` hooks

Theme CSS styles components through `data-slot` (and `data-variant`,
`data-size`, `data-active`, `data-dragging` where relevant) instead of class
names, because Tailwind class lists change often. The shadcn components in
`components/ui` carry a slot per part (`card`, `card-header`, `dialog-content`,
…). App-level containers use shared slots:

| Slot | Used on |
| --- | --- |
| `page-panel` | The main rounded content panel of each page (set by `PagePanel`) |
| `navbar`, `navbar-logo`, `nav-link` | Top navigation |
| `bottom-bar`, `social-link` | Footer |
| `calc-sidebar` | Recipe builder and extra calculator sidebars |
| `kofi-button` | Ko-fi support button |

Renaming or removing a `data-slot` does not break the build, but it silently
drops that theme styling. Search `apps/web/app/themes` for the slot before
changing it.

Wrap page content in `PagePanel` (`components/PagePanel.tsx`) rather than a
hand-written `rounded-xl bg-background` div. It renders the panel surface and the
`page-panel` slot; pass layout classes through `className`, the element through
`as` (for example `as="form"`), and `bare` when the content is embedded and
should not look like a page.

## Adding a theme

1. Create `apps/web/app/themes/<id>.css`, scoped as described above, with
   both light and dark tokens.
2. Import it from `apps/web/app/globals.css`.
3. Add `{ id: "<id>" }` to `DESIGN_THEMES` in `apps/web/lib/design-themes.ts`.
4. Add `accountPage.designTheme.<id>` to
   `packages/i18n/locales/en/default.json`. Weblate supplies the other
   locales (see [translation workflow](translation-workflow.md)).
5. Load any new fonts in `apps/web/app/layout.tsx` with a `variable` and
   `preload: false`, and add them to `designFontVariables`.

To remove a theme, reverse those steps, including fonts that no other theme
uses.
