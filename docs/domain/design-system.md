# Shared design-system boundaries

MeadTools shares visual primitives more broadly than it shares components.
`@meadtools/design-tokens` is framework-neutral and can be consumed by Expo,
Next.js, and a future Tauri/Vite frontend.

## Design tokens

The package owns:

- brand and semantic light/dark colors;
- stable spacing and radius scales;
- typography families, sizes, and weights;
- typed values for JavaScript/native consumers;
- generated CSS custom properties for DOM consumers.

The TypeScript token object is canonical. The committed CSS file is generated,
and parity tests prevent the two formats from drifting.

## DOM component sharing

A future `@meadtools/ui-web` package can share shadcn-based design and utility
components between the Next.js web app and Tauri/Vite desktop app. Appropriate
candidates include:

- searchable inputs and form controls;
- cards, dialogs, menus, and field composition;
- accessible interaction hooks;
- class-name and variant utilities.

Shared DOM components must not import Next.js routing, server components,
server-only modules, application data access, or page-level behavior.

## Native components

Expo consumes the same tokens but keeps React Native components. DOM and native
components may share interaction contracts and visual intent without pretending
that their rendering primitives are interchangeable.

Images remain app-local until two applications demonstrate the same asset and
compatible loading requirements.
