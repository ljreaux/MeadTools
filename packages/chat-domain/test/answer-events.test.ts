import assert from "node:assert/strict";
import test from "node:test";
import { chatAnswerEventSchema } from "../src/index";

test("transient previews accept public deltas and resets, rejecting arbitrary payloads", () => {
  assert.ok(chatAnswerEventSchema.safeParse({ type: "answer_delta", delta: "A mead answer" }).success);
  assert.ok(chatAnswerEventSchema.safeParse({ type: "answer_reset" }).success);
  assert.equal(chatAnswerEventSchema.safeParse({ type: "reasoning_delta", delta: "private" }).success, false);
  assert.equal(chatAnswerEventSchema.safeParse({ type: "answer_delta", delta: "x".repeat(70_000) }).success, false);
  assert.equal(chatAnswerEventSchema.safeParse({ type: "answer_delta", delta: "text", recipeData: {} }).success, false);
});
