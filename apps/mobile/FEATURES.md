# MeadTools Mobile feature plan

## Product role

MeadTools Mobile brings almost everything a brewer does on the web to iOS and
Android: building and browsing recipes, running brews from start to finish,
calculators, hydrometers, inventory and AI chat. Brew-day work keeps its
offline-first behavior. A short list of administrative and integration pages
stays on the web (see below).

## Release decision (November 15, 2026)

- **The first store release waits for parity** with the web feature set below,
  instead of shipping a smaller companion in January 2027.
- Monthly web releases continue with `Mobile production build: skip` until the
  parity areas and release readiness are complete. #439 covers the first `run`.
- **Premium is not purchasable on Mobile.** Accounts that bought Premium (or
  chat credits) on the web get the matching features on Mobile. Mobile has no
  purchase flow, prices, or calls to action to buy; Premium-only screens explain
  that the feature is part of Premium without linking to a checkout. Confirm the
  current App Store and Google Play rules for free companions to a paid web
  service before submission.

## Stays on the web

- Admin tools
- Desktop app download and taplist embed pages
- MCP and chatbot-marketplace integration setup
- Release emails and subscriber management
- Inventory spreadsheet import and export
- Premium and credit purchases, billing and Ko-fi/Stripe management

Legal pages, the contact form, release notes and the recipe builder tutorial are
reached through links to the web.

## Done

- Expo SDK 57, React Native 0.86, Expo Router, npm workspace integration
- EAS development, preview and production profiles; production builds only by
  approved dispatch
- Shared domain, schema, contract and API packages; environment-aware API client
- Password and Google sign-in, protected routes, SecureStore session restore
- Active brew list, brew overview, recent activity timeline
- Durable, account-scoped outbox: gravity (OG/FG, refractometer correction),
  temperature, pH, volume, additions, notes, tastings, issues and stage changes
  are saved on the device and synchronized exactly once (#444, #445, #522, #520)
- Online-only actions: entry edits and deletes, stock deduction for additions,
  stock-review notice when tracking is unavailable (#521)
- Planned recipe additions from the recipe snapshot (#532)
- Bottling with packaging stock and finished-mead output; untracked for free and
  expired accounts (#531)
- Device verification on iOS and Android, web parity, English and German (#446)
- Navigation shell: native tabs for Brews, Recipes, Tools, Inventory and
  Account, with placeholders until each area lands (#562)

## Parity areas

Each area becomes a parent issue with one child issue per slice, delivered as one
PR per parent with one commit per child (one Expo build per parent). Each area
also adds the typed `@meadtools/api-client` methods (and any missing
`@meadtools/api-contract` schemas) for its own routes; 14 of about 112 web API
routes are covered today. Suggested start: area 2's navigation shell, then
area 3 (calculators), with area 1's people-dependent work (artwork, store
accounts, tester distribution) in parallel.

### 1. Release readiness (#549)

- Branding: app icon, Android adaptive icon colors, splash, store name and slug
- Sign in with Apple on iOS (App Review guideline 4.8 expects it alongside
  Google sign-in), with a server endpoint
- Sign-in screen: forgot-password, create-account (in app or on the web) and
  privacy-policy links; clear message when Google finds no MeadTools account.
  If accounts can be created in the app, the stores also require in-app account
  deletion (area 12)
- Crash and error reporting
- Production configuration: Google client IDs for both platforms, EAS production
  environment
- Store setup: App Store Connect and Play Console listings, screenshots, privacy
  labels and Data safety, support and privacy URLs, age rating
- Early tester distribution: a real-device iOS build (the `preview` profile
  builds for the simulator only) through internal distribution or TestFlight,
  and a Play internal-testing track, so parity work can be tried on real phones
- Universal Links (iOS) and App Links (Android) for `https://meadtools.com`:
  a tapped MeadTools link opens the app when installed and the website
  otherwise, with web paths mapped to app routes; needs the production domain
  and Play signing key, so alongside tester distribution (`meadtools://` deep
  links already work)
- Over-the-air JavaScript updates (`expo-updates`) per channel once tester
  builds exist
- Google Play's closed-testing requirement, if it applies to the account, near
  the end with a near-final build

### 2. Platform (#550)

- Navigation shell: top-level sections (for example tabs for Brews, Recipes,
  Tools, Inventory and Account) so each parity area has a home. Start here.
- Mobile linting and the two existing lint errors
- Accessibility pass (screen readers, dynamic type), long-list performance

### 3. Calculators (#551)

Mostly shared math in `@meadtools/core`; available offline.

- Nutrient calculator
- Stabilizers (sulfite, sorbate)
- Juice and fruit sugar, yeast table
- Extra calculators: ABV, Brix, refractometer correction, temperature
  correction, estimated OG, blending, bench trials, priming sugar, bottling
- ABV without OG (Woodland Brew)

### 4. Brews: list and lifecycle (#552)

- Completed and archived brews alongside active ones, with search and filters
- Start a brew from a recipe; brew settings (name, batch, start date, email
  alerts, visibility)
- Update the recipe snapshot; delete a brew

### 5. Brew tracker parity (#553)

- Stage panels with checklists and warnings, matching the web tracker
- Yeast pitching (packets or weight, Go-Ferm) and OG logging dialogs
- Gravity and temperature charts
- Brew photos and cover images (Premium)
- Brew QR codes: scan to open a brew, show and share a brew's code (Premium)
- Containers and vessels (Premium)

### 6. Recipes: browse and view (#554)

- Your recipes list and recipe detail (ingredients, targets, nutrients,
  stabilizers, additives, notes)
- Recipe costs (Premium), covers, print or share

### 7. Recipe builder (#555)

- Create and edit recipes: ingredients, volumes, gravity targets, yeast,
  nutrients, stabilizers, additives, notes
- Open AI recipe drafts handed off from chat or MCP
- Move recipe state out of the web's `RecipeProvider` into a shared package so
  web and Mobile use one implementation

### 8. Hydrometers (#556)

- Linked devices (iSpindel, RAPT) and their brews
- Readings and logs, including a brew's live readings
- Device setup and tokens where practical on a phone; otherwise linked to the web

### 9. Inventory and equipment (Premium) (#557)

- Stock overview, add, edit, adjust and archive
- Finished meads and storage organization
- Equipment
- Costs and currency

### 10. Community (#558)

- Public recipes and brews: browse, search, view
- Comments and ratings
- Make a recipe or brew public

### 11. AI chat (Premium) (#559)

- Chat with conversations and drafts
- Credit balance and usage (no purchases)

### 12. Account (#560)

- Profile, username and avatar settings
- Premium and credit status (read-only)
- Product-update email preferences
- Account deletion request

## Localization direction

Git is the translation source of truth. `@meadtools/i18n` shares translation
resources and metadata while web and mobile keep platform-specific runtime
adapters. App-neutral keys should be reused when their meaning matches;
feature work changes English locale JSON, and Weblate generates German
suggestions after the change reaches `preview`. Mobile segment and toggle labels
need short translations. See `docs/translation-workflow.md` for review and
deployment behavior.
