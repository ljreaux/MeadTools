import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrewImageRequestBodySchema,
  updateBrewImageRequestBodySchema,
  brewImageAccessQueryParamsSchema,
} from "../src/zod/brew-images";
const upload = {
  operation_id: "11111111-1111-4111-8111-111111111111",
  content_type: "image/jpeg",
  base64: "YWJj",
};
test("brew image upload schemas bound formats, base64, captions and operation identity", () => {
  assert.equal(createBrewImageRequestBodySchema.parse(upload).caption, "");
  assert.equal(createBrewImageRequestBodySchema.parse({...upload,entry_id:upload.operation_id}).entry_id,upload.operation_id);
  for (const change of [
    { content_type: "image/svg+xml" },
    { base64: "!!!" },
    { base64: "data:image/jpeg;base64,YWJj" },
    { caption: "a".repeat(501) },
    { operation_id: "../foreign" },
    { entry_id: "../foreign" },
    { bucket: "foreign" },
  ]) {
    assert.equal(
      createBrewImageRequestBodySchema.safeParse({ ...upload, ...change })
        .success,
      false,
    );
  }
  assert.equal(
    updateBrewImageRequestBodySchema.safeParse({ caption: "hello", user_id: 5 })
      .success,
    false,
  );
  assert.deepEqual(brewImageAccessQueryParamsSchema.parse({ public: "true" }), {
    public: "true",
    variant: "image",
  });
  assert.equal(
    brewImageAccessQueryParamsSchema.safeParse({ variant: "original" }).success,
    false,
  );
});
