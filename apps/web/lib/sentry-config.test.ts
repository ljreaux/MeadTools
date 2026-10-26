import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const appRoot = new URL("../", import.meta.url);

/** Execute the actual entry points with a fake SDK and isolated environment.
 * No Sentry client, credentials, or network transport is loaded by these tests. */
function evaluate(
  path: string,
  env: Record<string, string | undefined>,
  modules: Record<string, unknown>,
) {
  const url = new URL(path, appRoot);
  const source = readFileSync(url, "utf8").replaceAll("import.meta.url", JSON.stringify(url.href));
  const compiled = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports: Record<string, any> = {};
  const imports: string[] = [];
  vm.runInNewContext(compiled, {
    exports,
    process: { env },
    URL,
    require: (name: string) => {
      imports.push(name);
      assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`);
      return modules[name];
    },
  }, { filename: fileURLToPath(url) });
  return { exports, imports };
}

function fakeSdk() {
  const initialized: Record<string, any>[] = [];
  const captures: unknown[] = [];
  const integrations: string[] = [];
  return {
    initialized, captures, integrations,
    sdk: {
      init: (options: Record<string, any>) => initialized.push(options),
      replayIntegration: () => { integrations.push("replay"); return "replay"; },
      feedbackIntegration: () => { integrations.push("feedback"); return "feedback"; },
      captureRouterTransitionStart: (...args: unknown[]) => captures.push(args),
      captureRequestError: (...args: unknown[]) => captures.push(args),
      captureException: (error: unknown) => captures.push(error),
    },
  };
}

test("only a production deployment enables the Sentry build wrapper and public flag", () => {
  for (const [nodeEnv, vercelEnv, expected] of [
    ["production", "production", true],
    // Vercel's config inspection can happen before Next sets NODE_ENV.
    [undefined, "production", true],
    ["production", "preview", false],
    ["production", "development", false],
    ["production", undefined, false],
    ["production", "staging", false],
    ["development", "production", false],
    ["test", "production", false],
  ] as const) {
    const wrappers: Record<string, any>[] = [];
    const { exports } = evaluate("next.config.ts", {
      NODE_ENV: nodeEnv,
      VERCEL_ENV: vercelEnv,
      // A stale public variable must not enable monitoring on previews.
      NEXT_PUBLIC_SENTRY_ENABLED: "true",
    }, {
      "@sentry/nextjs/config": {
        withSentryConfig: (config: unknown, options: Record<string, any>) => {
          wrappers.push(options);
          return config;
        },
      },
      "@next/mdx": () => (config: Record<string, any>) => ({ ...config, mdxEnabled: true }),
      "node:url": { fileURLToPath },
    });
    assert.equal(exports.default.env.NEXT_PUBLIC_SENTRY_ENABLED, String(expected));
    assert.equal(wrappers.length, Number(expected));
    assert.equal(exports.default.mdxEnabled, true);
    assert.ok(exports.default.transpilePackages.includes("@meadtools/i18n"));
    if (expected) {
      assert.equal(wrappers[0].widenClientFileUpload, true);
      assert.notEqual(wrappers[0].sourcemaps?.disable, true);
      assert.equal(wrappers[0].webpack.automaticVercelMonitors, true);
    }
  }
});

test("browser monitoring initializes only when enabled, with reduced replay and trace sampling", () => {
  for (const enabled of ["true", "false", undefined]) {
    const fake = fakeSdk();
    const { exports } = evaluate("instrumentation-client.ts", {
      NEXT_PUBLIC_SENTRY_ENABLED: enabled,
    }, { "@sentry/nextjs": fake.sdk });
    exports.onRouterTransitionStart("/account", "push");
    assert.equal(fake.initialized.length, enabled === "true" ? 1 : 0);
    assert.equal(fake.captures.length, enabled === "true" ? 1 : 0);
    assert.equal(fake.integrations.length, enabled === "true" ? 2 : 0);
    if (enabled === "true") {
      const options = fake.initialized[0];
      assert.equal(options.tracesSampleRate, 0.1);
      assert.equal(options.replaysSessionSampleRate, 0.01);
      assert.equal(options.replaysOnErrorSampleRate, 0.25);
      assert.equal(options.sampleRate ?? 1, 1);
      assert.ok(options.dsn);
    }
  }
});

test("server and edge monitoring keep production errors while sampling traces at ten percent", () => {
  for (const path of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
    for (const enabled of ["true", "false", undefined]) {
      const fake = fakeSdk();
      evaluate(path, { NEXT_PUBLIC_SENTRY_ENABLED: enabled }, { "@sentry/nextjs": fake.sdk });
      assert.equal(fake.initialized.length, enabled === "true" ? 1 : 0);
      if (enabled === "true") {
        assert.equal(fake.initialized[0].tracesSampleRate, 0.1);
        assert.equal(fake.initialized[0].sampleRate ?? 1, 1);
        assert.ok(fake.initialized[0].dsn);
      }
    }
  }
});

test("server hooks import no Sentry modules outside production", async () => {
  for (const runtime of ["nodejs", "edge"]) {
    for (const enabled of ["true", "false", undefined]) {
      const fake = fakeSdk();
      const { exports, imports } = evaluate("instrumentation.ts", {
        NEXT_RUNTIME: runtime, NEXT_PUBLIC_SENTRY_ENABLED: enabled,
      }, {
        "./sentry.server.config": {},
        "./sentry.edge.config": {},
        "@sentry/nextjs": fake.sdk,
      });
      await exports.register();
      await exports.onRequestError(new Error("fixture"), {}, {});
      if (enabled === "true") {
        assert.deepEqual(imports, [
          runtime === "nodejs" ? "./sentry.server.config" : "./sentry.edge.config",
          "@sentry/nextjs",
        ]);
        assert.equal(fake.captures.length, 1);
      } else {
        assert.deepEqual(imports, []);
        assert.equal(fake.captures.length, 0);
      }
    }
  }
});

test("the global error page only reports exceptions in production", () => {
  for (const enabled of ["true", "false", undefined]) {
    const fake = fakeSdk();
    const error = new Error("fixture");
    const { exports } = evaluate("app/global-error.tsx", { NEXT_PUBLIC_SENTRY_ENABLED: enabled }, {
      "@sentry/nextjs": fake.sdk,
      react: { useEffect: (effect: () => void) => effect() },
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
      "next/error": () => null,
    });
    exports.default({ error });
    assert.deepEqual(fake.captures, enabled === "true" ? [error] : []);
  }
});
