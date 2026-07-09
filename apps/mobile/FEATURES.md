# MeadTools Mobile feature plan

## Product role

MeadTools Mobile is a brew-day and fermentation companion. The web app remains
the complete product and primary recipe editor. Mobile should make an active
batch easier to monitor and update, especially when connectivity is poor.

## Current foundation

- Expo SDK 57 and React Native 0.86
- Expo Router with separate authenticated and unauthenticated route groups
- npm workspace integration
- EAS development, preview, and production build profiles
- EAS production workflow gated by mobile typechecking
- Access to the shared MeadTools domain, schema, contract, and API packages
- Environment-aware API client and TanStack Query providers
- Native password sign-in, protected routes, and SecureStore session restore

The foundation does not yet claim to provide authentication, synchronization,
offline persistence, or production-ready branding.

## Planned vertical slices

### 1. Read-only brew companion

- Native sign-in using the agreed API/auth contract
- List the signed-in user's active brews
- Open a brew and display its recipe snapshot, targets, stage, and recent
  timeline entries
- Use `@meadtools/api-client`, `@meadtools/api-contract`, and
  `@meadtools/brew-domain` rather than duplicating requests or projections

Exit: a user can sign in and inspect an active brew on iOS and Android.

### 2. Record one measurement safely

- Record a gravity measurement
- Assign a client UUID before submission
- Queue the entry locally when offline
- Retry through the idempotent brew-entry API
- Display pending, failed, and synchronized states

Exit: the same measurement synchronizes exactly once after connectivity
returns.

### 3. Brew-day additions and notes

- Record temperature, pH, and volume
- Record ingredient, nutrient, yeast, and additive additions
- Add general notes and stage-relevant observations
- Reuse shared payload builders and validation schemas

Exit: common brew-day timeline entries can be recorded without opening the web
app.

### 4. Fermentation monitoring

- Display gravity and temperature charts
- Show recent linked hydrometer readings
- Highlight stale readings and device connectivity state
- Cache the last useful view for poor connectivity

Exit: the mobile app provides a useful at-a-glance fermentation status.

### 5. Reminders and quick tools

- Local reminders for additions and measurements
- ABV, gravity/Brix, temperature correction, and stabilization tools
- Derived values calculated through `@meadtools/core`

Exit: the highest-value brew-day utilities work without a network request.

## Deferred

- Full recipe creation and editing
- Generic bidirectional recipe synchronization
- Hydrometer administration and device setup
- Admin tools, comments, ratings, and public recipe discovery
- Desktop-specific UI reuse

These can be reconsidered after the brew companion and offline outbox are
reliable.

## Localization direction

i18nexus remains the translation source of truth. `@meadtools/i18n` shares
translation resources and metadata while web and mobile keep platform-specific
runtime adapters. App-neutral keys should be reused when their meaning matches;
new source-language strings must be created through i18nexus rather than by
editing the generated JSON files.
