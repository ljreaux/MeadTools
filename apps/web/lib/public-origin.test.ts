import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicOrigin } from "./public-origin";

test("Preview OAuth and account links use the stable branch URL", () => {
  assert.equal(resolvePublicOrigin({
    vercelEnv: "preview",
    vercelBranchUrl: "mead-tools-git-438-larrys-projects.vercel.app",
    vercelUrl: "mead-tools-3oosa1jgm-larrys-projects.vercel.app",
    baseUrl: "https://preview.meadtools.com",
    nodeEnv: "production",
  }), "https://mead-tools-git-438-larrys-projects.vercel.app");
});

test("Preview can later use its permanent custom domain", () => {
  assert.equal(resolvePublicOrigin({
    vercelEnv: "preview",
    previewPublicOrigin: "https://preview.meadtools.com",
    vercelBranchUrl: "mead-tools-git-438-larrys-projects.vercel.app",
    nodeEnv: "production",
  }), "https://preview.meadtools.com");
});

test("Preview falls back to its deployment URL when there is no branch URL", () => {
  assert.equal(resolvePublicOrigin({
    vercelEnv: "preview",
    vercelUrl: "mead-tools-3oosa1jgm-larrys-projects.vercel.app",
    nodeEnv: "production",
  }), "https://mead-tools-3oosa1jgm-larrys-projects.vercel.app");
});

test("Production and local development use the configured app origin", () => {
  assert.equal(resolvePublicOrigin({
    vercelEnv: "production",
    baseUrl: "https://meadtools.com/",
    nodeEnv: "production",
  }), "https://meadtools.com");
  assert.equal(resolvePublicOrigin({
    baseUrl: "http://localhost:3000",
    nodeEnv: "development",
  }), "http://localhost:3000");
});

test("Preview does not accept arbitrary generated hosts or insecure custom origins", () => {
  assert.throws(() => resolvePublicOrigin({
    vercelEnv: "preview",
    vercelBranchUrl: "attacker.example.com",
  }));
  assert.throws(() => resolvePublicOrigin({
    vercelEnv: "preview",
    previewPublicOrigin: "http://preview.meadtools.com",
  }));
  assert.throws(() => resolvePublicOrigin({
    vercelEnv: "preview",
    previewPublicOrigin: "https://preview.meadtools.com/elsewhere",
  }));
});
