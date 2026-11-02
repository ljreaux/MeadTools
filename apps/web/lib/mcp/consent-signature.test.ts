import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifiedConsentPayload } from "./consent-signature";

test("canonical signed consent is accepted but suffix replay variants are rejected", () => {
  const secret = "fixture-secret".repeat(4);
  const payload = Buffer.from(JSON.stringify({ userId: 42 })).toString("base64url");
  const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
  assert.equal(verifiedConsentPayload(token, secret), payload);
  for (const suffix of [".", ".replay", ".a.b", "\n", "=", " "]) {
    assert.equal(verifiedConsentPayload(token + suffix, secret), null, JSON.stringify(suffix));
  }
  assert.equal(verifiedConsentPayload(token, "wrong-secret"), null);
  assert.equal(verifiedConsentPayload(`.${token}`, secret), null);
});
