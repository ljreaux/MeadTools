import assert from "node:assert/strict";
import test from "node:test";

import { classifyAppImpact, isTargetAffected } from "./app-impact.mjs";

test("app-local changes affect only their app", () => {
  assert.deepEqual(classifyAppImpact(["apps/mobile/app/index.tsx"]), {
    web: false,
    mobile: true,
    desktop: false,
  });

  assert.deepEqual(classifyAppImpact(["apps/web/app/page.tsx"]), {
    web: true,
    mobile: false,
    desktop: false,
  });
});

test("shared packages and root dependencies affect every app", () => {
  for (const changedPath of [
    "packages/core/src/index.ts",
    "package.json",
    "tsconfig.base.json",
  ]) {
    assert.deepEqual(classifyAppImpact([changedPath]), {
      web: true,
      mobile: true,
      desktop: true,
    });
  }
});

test("generated translation-only changes do not rebuild apps", () => {
  assert.deepEqual(
    classifyAppImpact([
      "packages/i18n/locales/de/default.json",
      "packages/i18n/locales/de/YeastTable.json",
    ]),
    {
      web: false,
      mobile: false,
      desktop: false,
    },
  );
});

test("translation updates deploy when combined with an app change", () => {
  assert.deepEqual(
    classifyAppImpact([
      "apps/web/app/page.tsx",
      "packages/i18n/locales/de/default.json",
    ]),
    {
      web: true,
      mobile: false,
      desktop: false,
    },
  );
});

test("the migration build pause overrides every affected app", () => {
  assert.deepEqual(
    classifyAppImpact(["apps/web/app/page.tsx"], { buildsPaused: true }),
    {
      web: false,
      mobile: false,
      desktop: false,
    },
  );
});

test("an app manifest and lockfile change affect only that app", () => {
  assert.deepEqual(
    classifyAppImpact([
      "apps/mobile/package.json",
      "package-lock.json",
    ]),
    {
      web: false,
      mobile: true,
      desktop: false,
    },
  );

  assert.deepEqual(
    classifyAppImpact(["apps/web/package.json", "package-lock.json"]),
    {
      web: true,
      mobile: false,
      desktop: false,
    },
  );
});

test("multiple app manifests and a lockfile affect each changed app", () => {
  assert.deepEqual(
    classifyAppImpact([
      "apps/mobile/package.json",
      "apps/web/package.json",
      "package-lock.json",
    ]),
    {
      web: true,
      mobile: true,
      desktop: false,
    },
  );
});

test("unexplained lockfile changes safely affect every app", () => {
  for (const changedPaths of [
    ["package-lock.json"],
    ["README.md", "package-lock.json"],
    ["apps/mobile/src/app/index.tsx", "package-lock.json"],
  ]) {
    assert.deepEqual(classifyAppImpact(changedPaths), {
      web: true,
      mobile: true,
      desktop: true,
    });
  }
});

test("deployment configuration affects its target", () => {
  assert.equal(isTargetAffected("web", ["vercel.json"]), true);
  assert.equal(isTargetAffected("mobile", ["vercel.json"]), false);
});

test("documentation and workflow-only changes do not rebuild apps", () => {
  assert.deepEqual(
    classifyAppImpact([
      "README.md",
      "docs/mobile-app-features.md",
      ".github/workflows/quality.yml",
    ]),
    {
      web: false,
      mobile: false,
      desktop: false,
    },
  );
});

test("rejects unknown targets", () => {
  assert.throws(
    () => isTargetAffected("watch", ["apps/watch/app.tsx"]),
    /Unknown target/,
  );
});
