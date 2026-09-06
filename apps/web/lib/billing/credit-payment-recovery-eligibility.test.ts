import assert from "node:assert/strict";
import test from "node:test";
import { canReleasePaymentRestrictedChat } from "./credit-payment-recovery-eligibility";

test("payment recovery only releases chat after the final review case resolves with a non-negative balance", () => {
  assert.equal(
    canReleasePaymentRestrictedChat({
      releaseRequested: true,
      unresolvedRecoveryCount: 0,
      availableCredits: 0,
    }),
    true,
  );
  assert.equal(
    canReleasePaymentRestrictedChat({
      releaseRequested: true,
      unresolvedRecoveryCount: 1,
      availableCredits: 10,
    }),
    false,
  );
  assert.equal(
    canReleasePaymentRestrictedChat({
      releaseRequested: true,
      unresolvedRecoveryCount: 0,
      availableCredits: -1,
    }),
    false,
  );
  assert.equal(
    canReleasePaymentRestrictedChat({
      releaseRequested: false,
      unresolvedRecoveryCount: 0,
      availableCredits: 10,
    }),
    false,
  );
});
