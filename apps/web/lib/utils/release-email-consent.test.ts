import assert from "node:assert/strict";
import test from "node:test";
import { consentDates, releaseEmailResponse } from "../release-email-consent";

test("existing accounts begin unprompted and opted out", () => {
  assert.deepEqual(releaseEmailResponse(null), {
    prompted: false,
    web: false,
    mobile: false,
    chat: false,
    api: false,
  });
});

test("saving an opt-in records consent and opting out removes eligibility", () => {
  const first = new Date("2026-10-04T00:00:00Z");
  const second = new Date("2026-10-05T00:00:00Z");
  const optedIn = consentDates(
    null,
    { web: true, mobile: false, chat: false, api: false },
    first,
  );
  assert.equal(optedIn.web_opted_in_at, first);
  const unchanged = consentDates(
    optedIn,
    { web: true, mobile: false, chat: false, api: false },
    second,
  );
  assert.equal(unchanged.web_opted_in_at, first);
  const optedOut = consentDates(
    unchanged,
    { web: false, mobile: false, chat: false, api: false },
    second,
  );
  assert.equal(optedOut.web_opted_in_at, null);
});
