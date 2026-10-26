# Sentry build comparison

Issue: [#482](https://github.com/ljreaux/MeadTools/issues/482)

## Before: Sentry enabled on a preview deployment

Successful uncached redeploy of `29587668d`, October 25, 2026 (America/Chicago).
The supplied log timestamps below are preserved as printed.

| Measurement | Baseline |
| --- | --- |
| Build machine | Enhanced: 8 cores, 16 GB RAM |
| Region | iad1 |
| Cache | Explicitly skipped |
| Build starts | 20:12:42.504 |
| Dependency install | 37 seconds; 2,152 packages |
| Compilation | 20:13:28.170–20:17:18.792; about 3 min 51 sec |
| TypeScript | 32.1 seconds |
| Static pages | 52 pages in 6.0 seconds |
| Build completed | 20:18:23.710 |
| Deployment completed | 20:18:36.234 |
| Start through deployment | About 5 min 54 sec |
| Sentry source-map passes | Server: 845 files; edge: 845 files; browser: 1,416 files |

These are log durations, not Vercel's final billable CPU minutes. The supplied
log ends when cache creation begins, so it does not establish the complete
post-build billing duration.

Basic (2 cores, 8 GB) and Standard (4 cores, 8 GB) attempts both reported
container out-of-memory failures during compilation. Enhanced succeeded.

## Changes being measured

- Only a Vercel production deployment outside development/test mode uses
  `withSentryConfig`. Preview and local builds skip the wrapper, including
  Sentry's automatic build instrumentation and source-map generation/uploads.
- Next config publishes only a boolean `NEXT_PUBLIC_SENTRY_ENABLED` build
  flag. The browser, server, edge initialization, and capture hooks use that
  same flag. It cannot be enabled merely by `NODE_ENV=production` on a preview.
- Production keeps its existing source-map upload settings and error sampling.
- Production traces: 10%; ordinary session replays: 1%; error-triggered replay
  sampling: 25%. Logs and feedback integration remain enabled in production.

## After: verification and measurement

1. Build the new preview on Enhanced in iad1 with cache disabled, matching the
   baseline. Keep the machine and memory settings unchanged for this comparison.
2. Confirm all server, edge and client Sentry source-map upload passes are
   absent. Ordinary Next.js build tracing is unrelated and should remain.
3. Record dependency install, compilation, TypeScript, static generation,
   deployment completion, and the dashboard's final billable duration and CPU
   minutes. Compare compilation separately from installation and deployment.
4. In the deployed preview, verify normal application behavior and that no
   Sentry event/replay requests are sent during navigation or a handled error.
5. After an approved production release, verify a real production issue has
   readable source-mapped frames and the expected replay/trace configuration.
   Sampling means an individual session or trace need not be recorded.
6. Once the Enhanced comparison is recorded, optionally retry Standard to
   determine whether the optimized preview fits in 8 GB and costs less overall.

`apps/web/lib/sentry-config.test.ts` exercises the actual configuration and
instrumentation entry points with a fake SDK. It checks environment gating,
sampling, production capture hooks, and retained source-map configuration
without importing a live Sentry SDK or contacting Sentry. Deployed source-map
resolution and memory savings still require the deployment checks above.
