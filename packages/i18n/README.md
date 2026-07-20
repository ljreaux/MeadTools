# @meadtools/i18n

Shared locale metadata and translation resources for MeadTools apps.

## Source of truth

Git is the source of truth. English source strings and reviewed German
translations live under `locales/`. Weblate adds unapproved German suggestions
to `preview`; human corrections are German-only PRs.

The package deliberately contains no React, Next.js, or Expo initialization.
Each app owns its framework-specific i18next setup while consuming the same
locale metadata and resources from this package.
