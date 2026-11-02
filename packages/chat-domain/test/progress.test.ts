import assert from "node:assert/strict";
import test from "node:test";
import { chatProgress } from "../src/index";

const failed = { name: "fetch_wiki_page", status: "error" as const };

test("a recoverable tool failure is still working, not a failed request", () => {
  assert.deepEqual(chatProgress([failed]), { phase: "recovering" });
});

test("retry activity replaces a prior failure and successful recovery clears it", () => {
  const retry = { name: "fetch_wiki_page", status: "running" as const };
  assert.deepEqual(chatProgress([failed, retry]), { phase: "working", toolName: "fetch_wiki_page" });
  assert.deepEqual(chatProgress([failed, { ...retry, status: "ok" }]), { phase: "writing" });
});

test("live answer text takes precedence over a historical lookup error", () => {
  assert.deepEqual(chatProgress([failed], true), { phase: "writing" });
});

test("a new request starts clean and a new failure remains visible as recovery", () => {
  assert.deepEqual(chatProgress([]), { phase: "checking" });
  assert.deepEqual(chatProgress([{ name: "get_brew", status: "ok" }, failed]), { phase: "recovering" });
});
