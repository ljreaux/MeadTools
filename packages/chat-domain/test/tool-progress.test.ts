import assert from "node:assert/strict";
import test from "node:test";
import { describeChatToolProgress, chatToolProgressDetailSchema } from "../src/index";

test("sensor summary progress shows the actual count without clamping large histories", () => {
  assert.deepEqual(describeChatToolProgress("summarize_brew_sensor_history", {}, { status: "ok", result: { sampleCount: 289 } }), { count: 289 });
  assert.deepEqual(describeChatToolProgress("summarize_brew_sensor_history", {}, { status: "ok", result: { sampleCount: 100001 } }), {});
});

test("specific labels use catalog queries and authenticated record names, never record IDs", () => {
  assert.deepEqual(describeChatToolProgress("search_yeasts", { query: "Lalvin EC1118" }), { subject: "Lalvin EC1118" });
  assert.deepEqual(describeChatToolProgress("get_recipe", { id: 123 }, { status: "ok", result: { recipe: { untrustedName: "Traditional Test" } } }), { subject: "Traditional Test" });
  assert.deepEqual(describeChatToolProgress("get_recipe", { id: 123 }), {});
});

test("draft targets and lookup counts can be displayed without exposing payloads", () => {
  assert.deepEqual(describeChatToolProgress("build_recipe_draft", { batchVolume: { value: 3, unit: "L" }, targetAbv: 10, nutrients: { yeastBrand: "Lalvin", yeastStrain: "71B" } }), { subject: "3 L · 10% ABV · Lalvin 71B" });
  assert.deepEqual(describeChatToolProgress("get_brew_timeline", {}, { status: "ok", result: { items: [{}, {}] } }), { count: 2 });
});

test("recovery explains missing fields and volume conflicts, not raw exceptions", () => {
  assert.deepEqual(describeChatToolProgress("build_recipe_draft", {}, { status: "ok", result: { status: "needs_input", questions: [{ id: "batch_volume" }, { id: "nutrient_plan" }] } }), { issue: "missing_inputs", missing: ["batch_size", "nutrients"] });
  assert.deepEqual(describeChatToolProgress("build_recipe_draft", {}, { status: "ok", result: { status: "error", code: "calculation_failed", message: "Fixed ingredients exceed volume" } }), { issue: "volume_conflict" });
  assert.deepEqual(describeChatToolProgress("search_yeasts", {}, { status: "error", message: "Bearer secret /private/path" }), { issue: "lookup_failed" });
});

test("source details omit credentials and query strings and bound untrusted labels", () => {
  assert.deepEqual(describeChatToolProgress("fetch_wiki_page", { url: "https://wiki.meadtools.com/en/process/stabilization?token=private" }), { subject: "stabilization" });
  assert.deepEqual(describeChatToolProgress("fetch_wiki_page", { url: "https://secret@evil.example/private" }), {});
  const detail = describeChatToolProgress("search_yeasts", { query: "Bearer secret\n" + "x".repeat(200) });
  assert.ok(chatToolProgressDetailSchema.safeParse(detail).success);
  assert.doesNotMatch(detail.subject!, /secret|\n/);
  assert.ok(detail.subject!.length <= 120);
});

test("source failures expose a safe HTTP status or approved-result mismatch, never raw text", () => {
  assert.deepEqual(describeChatToolProgress("fetch_wiki_page", {}, { status: "error", message: "Wiki retrieval failed with HTTP 404." }), { issue: "source_http_error", httpStatus: 404 });
  assert.deepEqual(describeChatToolProgress("fetch_wiki_page", {}, { status: "invalid_input", issues: ["Select a non-recipe page returned by the current wiki search before fetching it."] }), { issue: "source_not_approved" });
  assert.deepEqual(describeChatToolProgress("fetch_wiki_page", {}, { status: "error", message: "Wiki retrieval failed with HTTP 404. Bearer secret" }), { issue: "source_unavailable" });
});
