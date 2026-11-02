import assert from "node:assert/strict";
import test from "node:test";
import {
  BREW_IMAGE_LIMITS as limits,
  canReadBrewImage,
  checkBrewImageAllowance,
  projectBrewImage,
} from "../src/images";
const empty = { usedBytes: 0, brewCount: 0, pendingCount: 0, dailyAttempts: 0 };
test("reservations include both stored variants and bound slots, bytes, processing and attempts", () => {
  const bytes = limits.displayBytes + limits.thumbnailBytes;
  assert.equal(checkBrewImageAllowance(empty), bytes);
  assert.equal(
    checkBrewImageAllowance({
      ...empty,
      usedBytes: limits.accountBytes - bytes,
    }),
    bytes,
  );
  for (const [change, code] of [
    [{ usedBytes: limits.accountBytes - bytes + 1 }, "QUOTA_EXCEEDED"],
    [{ brewCount: 20 }, "BREW_IMAGE_LIMIT"],
    [{ pendingCount: 2 }, "UPLOAD_IN_PROGRESS"],
    [{ dailyAttempts: 100 }, "RATE_LIMITED"],
  ] as const)
    assert.throws(() => checkBrewImageAllowance({ ...empty, ...change }), {
      message: code,
    });
});
test("public access needs both visibility decisions and an active owner; expiry does not revoke reads", () => {
  const input = {
    activeOwner: true,
    ownsBrew: false,
    brewPublic: true,
    recipePublic: true,
  };
  assert.equal(canReadBrewImage(input), true);
  for (const field of ["activeOwner", "brewPublic", "recipePublic"] as const)
    assert.equal(canReadBrewImage({ ...input, [field]: false }), false);
  assert.equal(
    canReadBrewImage({
      ...input,
      ownsBrew: true,
      brewPublic: false,
      recipePublic: false,
    }),
    true,
  );
  assert.equal(
    canReadBrewImage({ ...input, ownsBrew: true, activeOwner: false }),
    false,
  );
});
test("public metadata is allowlisted and never exposes storage keys or owner details", () => {
  const record = {
    id: "id",
    caption: "Mead",
    width: 10,
    height: 20,
    size_bytes: 50,
    created_at: new Date("2026-10-25T00:00:00Z"),
    image_key: "private",
    user_id: 10,
    request_hash: "private",
  };
  assert.deepEqual(projectBrewImage(record), {
    id: "id",
    caption: "Mead",
    entry_id: null,
    entry_title: null,
    entry_datetime: null,
    entry_hidden: false,
    width: 10,
    height: 20,
    size_bytes: 50,
    created_at: "2026-10-25T00:00:00.000Z",
  });
});
