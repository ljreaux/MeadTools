import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrewImageRequestBodySchema,
  createRecipeImageRequestBodySchema,
  recipeImagesPathParamsSchema,
  setCoverImageRequestBodySchema,
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

test("recipe image and cover contracts reject foreign entry IDs and malformed record/selection IDs", () => {
  assert.equal(createRecipeImageRequestBodySchema.safeParse(upload).success,true);
  assert.equal(createRecipeImageRequestBodySchema.safeParse({...upload,entry_id:upload.operation_id}).success,false);
  assert.deepEqual(setCoverImageRequestBodySchema.parse({image_id:null}),{image_id:null});
  for (const body of [{}, {image_id:"foreign"}, {image_id:null,user_id:1}]) assert.equal(setCoverImageRequestBodySchema.safeParse(body).success,false);
  for (const id of ["0","-1","1.5","1e3","2147483648","9007199254740993"]) assert.equal(recipeImagesPathParamsSchema.safeParse({id}).success,false);
  assert.equal(recipeImagesPathParamsSchema.safeParse({id:"2147483647"}).success,true);
});

test("brew uploads opt into cover selection explicitly; recipe uploads use their automatic behavior", () => {
  assert.equal(createBrewImageRequestBodySchema.parse({...upload,set_as_cover:true}).set_as_cover,true);
  assert.equal(createBrewImageRequestBodySchema.parse(upload).set_as_cover,undefined);
  assert.equal(createBrewImageRequestBodySchema.safeParse({...upload,set_as_cover:"true"}).success,false);
  assert.equal(createRecipeImageRequestBodySchema.safeParse({...upload,set_as_cover:true}).success,false);
});
