import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowPremiumLaunchNotice } from "./premium-launch-notice";

const eligible = {
  signedIn: true, dismissed: false, onPremiumPage: false,
  status: { subscriptionsEnabled: true, entitled: false, paymentRestricted: false },
};

test("premium promotion waits for subscriptions to open and a successful status read", () => {
  assert.equal(shouldShowPremiumLaunchNotice(eligible), true);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible, status: undefined }), false);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible,
    status: { ...eligible.status, subscriptionsEnabled: false } }), false);
});

test("premium promotion excludes signed-out, existing-member, restricted, and dismissed accounts", () => {
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible, signedIn: false }), false);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible, dismissed: true }), false);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible, onPremiumPage: true }), false);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible,
    status: { ...eligible.status, entitled: true } }), false);
  assert.equal(shouldShowPremiumLaunchNotice({ ...eligible,
    status: { ...eligible.status, paymentRestricted: true } }), false);
});
