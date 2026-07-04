# MeadTools Mobile

Expo/React Native companion app for MeadTools. The app intentionally starts
with a minimal shell; product flows will be added as vertical slices instead
of carrying forward the Expo starter tutorial.

## Local development

Install workspace dependencies from the repository root:

```sh
npm install
```

Start the Expo development server:

```sh
npm run dev:mobile
```

Open a platform directly:

```sh
npm run mobile:ios
npm run mobile:android
```

Run the mobile TypeScript check:

```sh
npm run mobile:typecheck
```

Expo CLI commands that affect EAS configuration or credentials should be run
from `apps/mobile`, where `app.json`, `eas.json`, and `.eas/workflows` live.

## EAS builds

The EAS project must be connected to the `ljreaux/MeadTools` repository in its
GitHub settings before branch pushes can start workflows automatically.

- Merges into `preview` create an Android internal build and an unsigned iOS
  Simulator build.
- Merges into `main` create Android and iOS production builds.
- Production iOS builds require Apple Developer Program membership and signing
  credentials; preview Simulator builds do not.

## Project shape

- `src/app` owns Expo Router routes and layouts.
- Shared recipe and brew behavior comes from `packages/*`.
- Network access will go through `@meadtools/api-client`.
- Prisma, database code, Next.js modules, and web UI must not be imported.
- Generated native `ios` and `android` folders remain ignored while the app
  uses Expo Continuous Native Generation.

See [FEATURES.md](./FEATURES.md) for the planned product slices and boundaries.
