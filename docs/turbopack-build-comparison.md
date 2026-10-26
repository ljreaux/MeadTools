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

## Vercel comparison

Both deployments used Enhanced (8 cores, 16 GB), iad1, the preview environment,
and explicitly skipped the build cache. The automatic cached PR deployment was
canceled before running the uncached comparison.

The Sentry-disabled webpack baseline is deployment
`dpl_3UTU3CayZwmw69dxvMTXahEFvkpe`, commit `2ebdf6bb5`:

The Turbopack deployment is
[`dpl_6EM1CVp1hPwiRWXTneEafY9Xs3Dv`](https://vercel.com/larry-reauxs-projects/mead-tools/6EM1CVp1hPwiRWXTneEafY9Xs3Dv),
commit `61396a206`. It reached READY on October 26, 2026.

| Measurement | Vercel webpack baseline | Vercel Turbopack |
| --- | ---: | ---: |
| Install | 37 s; 2,152 packages | 46 s; 2,152 packages |
| Compilation | 161.4 s | 36.9 s |
| TypeScript | 35.1 s | 42 s |
| Static generation | 52 pages in 7.0 s | 52 pages in 0.888 s |
| Start through deployment | 290.7 s | 158.4 s |
| Final billable CPU minutes | Not recorded | Not established |

Compilation improved about 77%; start through deployment improved about 45%
(132 seconds), despite installation and TypeScript taking longer. These are
single-run elapsed times, not measured billable CPU savings. The logs confirm
the Turbopack build command and contain no Sentry source-map upload passes or
out-of-memory errors. Post-deployment cache creation/upload is excluded from the
elapsed comparison, matching the earlier baseline definition.

The live preview's English/German recipe builders hydrated successfully. The
MDX yeast/Go-Ferm article rendered headings and code blocks in the Hive theme,
and Scalar API documentation hydrated with navigation and endpoint groups.
No authenticated writes or live AI requests were used for verification.

A normal production release must separately verify readable Sentry stack frames
and retained sampling. A separate Standard-machine retry would be needed to
establish whether 8 GB is now sufficient. Prior Basic and Standard builds ran
out of memory, so these results do not yet justify changing machines.
