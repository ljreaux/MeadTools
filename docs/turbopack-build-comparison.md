# Turbopack production build trial

Issue: [#485](https://github.com/ljreaux/MeadTools/issues/485)

## Change and fallback

The default web `build` and `vercel-build` scripts explicitly select
`--turbopack` instead of `--webpack`. Prisma generation, deployment migrations,
the 8 GB Node heap limit, TypeScript checking, and the Next launcher are unchanged.
No dependency upgrades or application changes are required.

From the repository root, `npm run build:webpack` runs the previous local build.
For Vercel, `npm run vercel-build:webpack` preserves the previous deployment build,
including migrations. Do not run that deployment command against the local
development database. Both fallback scripts also exist in the web workspace.

## Local comparison

Both builds ran on the same Mac checkout, based on `e0ed82625`, using Next.js
16.3.4 and `VERCEL_ENV=preview`. Prisma generation ran once before measurement.
Each build started without an `apps/web/.next` output directory. Turbopack ran
first; its output was moved aside before webpack ran. This is a single local
comparison, not a Vercel benchmark or repeated statistical measurement.

The measured command in `apps/web` was `/usr/bin/time -l node
--max-old-space-size=8192 ../../scripts/run-next.mjs build`, with the respective
bundler flag. Installation, Prisma generation, and deployment are excluded.

| Measurement | webpack | Turbopack |
| --- | ---: | ---: |
| Compilation | 62.0 s | 17.5 s |
| TypeScript | 14.1 s | 14.7 s |
| Static generation (52 pages) | 2.8 s | 0.307 s |
| Total elapsed | 94.48 s | 36.00 s |
| Maximum resident set (bytes) | 5,511,168,000 | 4,940,840,960 |
| Peak memory footprint (bytes) | 7,336,184,440 | 4,796,160,800 |

Compilation fell about 72%; total local elapsed time fell about 62%. The macOS
memory measurements are process accounting, not total Vercel container memory.
They do not establish whether an 8 GB Vercel machine will succeed or how many
billable CPU minutes will be saved.

## Compatibility checked

- Both complete production-mode preview builds succeeded, including TypeScript,
  Prisma/workspace imports, and generation of all 52 static pages.
- The existing MDX configuration uses serializable plugin names/options. The
  built yeast/Go-Ferm page rendered headings and styled code blocks correctly.
- The production server rendered English and German recipe builders, the Hive
  theme, and the mobile layout. Scalar's `/api` documentation hydrated with its
  navigation and endpoint groups. No API requests were executed from Scalar.
- All 237 web tests passed. The new real-configuration checks load Next, MDX,
  and Sentry in isolated processes without executing instrumentation or upload
  hooks. Preview keeps MDX and disables Sentry; production retains MDX, Sentry
  instrumentation, browser source maps, native debug IDs, and the upload hook.
- Sentry's webpack-only options remain unchanged. This trial does not claim
  automatic Vercel monitor creation or webpack debug-log tree shaking under
  Turbopack. Production source-map resolution still needs a deployment check.
- The webpack build retained its existing Scalar critical-dependency warning.
  Scalar refactoring is outside this trial.

For local serving, bind `next start` to `localhost`. Binding to `127.0.0.1`
produced a self-redirect on unprefixed English URLs with both bundlers; using
`localhost` resolved the test-server behavior without an application change.

## Vercel comparison still required

Keep Enhanced (8 cores, 16 GB), iad1, preview environment, and cache disabled for
the first deployment. Do not change machines during this comparison.

The Sentry-disabled webpack baseline is deployment
`dpl_3UTU3CayZwmw69dxvMTXahEFvkpe`, commit `2ebdf6bb5`:

| Measurement | Vercel webpack baseline | Vercel Turbopack |
| --- | ---: | ---: |
| Install | 37 s; 2,152 packages | Pending |
| Compilation | 161.4 s | Pending |
| TypeScript | 35.1 s | Pending |
| Static generation | 52 pages in 7.0 s | Pending |
| Start through deployment | 290.7 s | Pending |
| Final billable CPU minutes | Not recorded | Pending |

Record the same stages and the dashboard's final CPU usage for the new build.
Verify the deployed preview's recipe builder, MDX, translations, themes, API
documentation, and absence of Sentry uploads/events. A normal production release
must separately verify readable Sentry stack frames and retained sampling.
Only after that comparison should a separate Standard-machine retry be used to
establish whether 8 GB is now sufficient. Prior Basic and Standard builds ran
out of memory, so local memory numbers alone are insufficient to change machines.
