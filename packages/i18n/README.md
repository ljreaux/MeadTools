# @meadtools/i18n

Shared locale metadata and generated translation resources for MeadTools apps.

## Source of truth

i18nexus is the source of truth. Files under `locales/` are generated output and
must not be edited directly.

Use the workspace commands from the repository root:

```bash
npm run i18n:pull
npm run i18n:listen
```

The package deliberately contains no React, Next.js, or Expo initialization.
Each app owns its framework-specific i18next setup while consuming the same
locale metadata and resources from this package.
