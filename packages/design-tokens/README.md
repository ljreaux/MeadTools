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

Semantic variables such as `--mt-color-background` and `--mt-color-text` use
the light theme by default and switch when a
`.dark` ancestor is active. Fully qualified light and dark values are also
available.

Run `npm run generate --workspace @meadtools/design-tokens` after changing the
typed token source. Tests fail if the committed CSS output drifts.

This package does not contain React components or platform behavior. A future
`@meadtools/ui-web` package may share shadcn-based DOM components and utilities
between Next.js and Tauri/Vite. Expo should use native components while
consuming these tokens.
