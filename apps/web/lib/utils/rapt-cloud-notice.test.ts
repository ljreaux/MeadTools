import assert from "node:assert/strict";
import test from "node:test";
import { RAPT_CLOUD_NOTICE_EXPIRES_AT, shouldShowRaptCloudNotice } from "./rapt-cloud-notice";

test("RAPT notice requires sign-in and respects permanent dismissal", () => {
  const now = RAPT_CLOUD_NOTICE_EXPIRES_AT - 1;
  assert.equal(shouldShowRaptCloudNotice({ isLoggedIn: false, dismissed: false, now }), false);
  assert.equal(shouldShowRaptCloudNotice({ isLoggedIn: true, dismissed: true, now }), false);
  assert.equal(shouldShowRaptCloudNotice({ isLoggedIn: true, dismissed: false, now }), true);
});

test("RAPT notice stops at the shared deadline", () => {
  for (const now of [RAPT_CLOUD_NOTICE_EXPIRES_AT, RAPT_CLOUD_NOTICE_EXPIRES_AT + 1]) {
    assert.equal(shouldShowRaptCloudNotice({ isLoggedIn: true, dismissed: false, now }), false);
  }
});
