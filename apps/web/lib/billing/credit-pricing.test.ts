import assert from "node:assert/strict";
import test from "node:test";
import { calculateProviderCostPicousd } from "@meadtools/credit-accounting";
import { initialOpenAIGpt56LunaPricing } from "./credit-pricing";
import { DEFAULT_OPENAI_MODEL } from "../ai/chat-config";

test("Luna pricing separately accounts for cached input and output", () => {
  const cost = calculateProviderCostPicousd(
    { inputTokens: 1_000_000, cachedInputTokens: 200_000, outputTokens: 1_000_000 },
    initialOpenAIGpt56LunaPricing.pricing,
  );
  assert.equal(cost, BigInt(1_364_000_000_000));
});

test("deployment migration and runtime Luna pricing use the same immutable version", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../../prisma/migrations/20261019000000_add_openai_gpt56_luna_credit_pricing/migration.sql", import.meta.url), "utf8");
  const values = sql.match(/VALUES\s*\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']+)'\s*\)/);
  assert.ok(values, "Luna migration must contain a reviewable literal price snapshot");
  const p = initialOpenAIGpt56LunaPricing;
  assert.equal(p.model, DEFAULT_OPENAI_MODEL);
  assert.deepEqual(values.slice(1), [p.provider, p.model, p.version,
    p.pricing.uncachedInputPicousdPerMillionTokens.toString(),
    p.pricing.cachedInputPicousdPerMillionTokens.toString(),
    p.pricing.outputPicousdPerMillionTokens.toString(), p.effectiveAt.toISOString()]);
  assert.match(sql, /ON CONFLICT \("provider", "model", "version"\) DO NOTHING/);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|TRUNCATE)\s+"/i);
});

test("deployment build applies pricing migrations before building the application", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const steps = manifest.scripts["vercel-build"].split("&&").map((step: string) => step.trim());
  assert.equal(steps[0], "npx prisma migrate deploy");
  assert.ok(steps.slice(1).some((step: string) => /run-next\.mjs build/.test(step)));
});
