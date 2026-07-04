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

The app uses `https://meadtools.com` by default. To point a local or preview
build at another API, copy `apps/mobile/.env.example` to
`apps/mobile/.env.local` and set `EXPO_PUBLIC_MEADTOOLS_API_URL` to an absolute
HTTP or HTTPS URL. EAS environments can provide the same variable without a
committed environment file.

Google sign-in additionally uses platform OAuth client IDs:

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for an Expo web build

The API must receive the corresponding server-side `GOOGLE_IOS_CLIENT_ID` and
`GOOGLE_ANDROID_CLIENT_ID` values so it can verify native Google ID-token
audiences. Client IDs are public identifiers; Google client secrets remain
server-only and must never use an `EXPO_PUBLIC_` variable.

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

- `src/app/(auth)` and `src/app/(app)` keep unauthenticated and authenticated
  routes separate.
- `src/providers` owns app-wide API and query state.
- Native sessions are persisted with Expo SecureStore; access tokens are
  supplied to the shared API client at request time.
- Shared recipe and brew behavior comes from `packages/*`.
- Network access goes through the app-level `@meadtools/api-client` instance.
- Prisma, database code, Next.js modules, and web UI must not be imported.
- Generated native `ios` and `android` folders remain ignored while the app
  uses Expo Continuous Native Generation.

See [FEATURES.md](./FEATURES.md) for the planned product slices and boundaries.
