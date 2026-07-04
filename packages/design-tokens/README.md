# MeadTools design tokens

`@meadtools/design-tokens` is the platform-neutral source of truth for shared
brand colors and stable semantic design primitives.

React Native consumers import typed values:

```ts
import { colorThemes, spacing } from "@meadtools/design-tokens";
```

DOM consumers can import generated CSS custom properties:

```css
@import "@meadtools/design-tokens/css";
```

The `--mt-web-light-*` and `--mt-web-dark-*` variables preserve the exact HSL
channels used by the existing Tailwind/shadcn theme. Typed semantic colors are
derived from those same channels for React Native and JavaScript consumers.

Run `npm run generate --workspace @meadtools/design-tokens` after changing the
typed token source. Tests fail if the committed CSS output drifts.

This package does not contain React components or platform behavior. A future
`@meadtools/ui-web` package may share shadcn-based DOM components and utilities
between Next.js and Tauri/Vite. Expo should use native components while
consuming these tokens.
