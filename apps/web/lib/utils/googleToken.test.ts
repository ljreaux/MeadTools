import assert from "node:assert/strict";
import test from "node:test";

import { verifyGoogleTokenEmail } from "@/lib/auth/google-token";

test("uses the verified Google access-token email and audience", async () => {
  const email = await verifyGoogleTokenEmail({
    allowedAudiences: ["web-client"],
    client: {
      getTokenInfo: async () => ({
        aud: "web-client",
        email: "verified@example.com",
        email_verified: true
      }),
      verifyIdToken: async () => ({
        getPayload: () => undefined
      })
    },
    token: "ya29.verified-access-token"
  });

  assert.equal(email, "verified@example.com");
});

test("rejects Google access tokens issued to another client", async () => {
  const email = await verifyGoogleTokenEmail({
    allowedAudiences: ["expected-client"],
    client: {
      getTokenInfo: async () => ({
        aud: "attacker-client",
        email: "user@example.com",
        email_verified: true
      }),
      verifyIdToken: async () => ({
        getPayload: () => undefined
      })
    },
    token: "ya29.wrong-audience"
  });

  assert.equal(email, null);
});

test("uses the verified email from a Google ID token", async () => {
  const email = await verifyGoogleTokenEmail({
    allowedAudiences: ["ios-client"],
    client: {
      getTokenInfo: async () => {
        throw new Error("Access-token verification should not run");
      },
      verifyIdToken: async ({ audience, idToken }) => {
        assert.deepEqual(audience, ["ios-client"]);
        assert.equal(idToken, "google-id-token");
        return {
          getPayload: () => ({
            email: "ios@example.com",
            email_verified: true
          })
        };
      }
    },
    token: "google-id-token"
  });

  assert.equal(email, "ios@example.com");
});
