import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMcpClientRegistration } from "./client-registration";

const googleCallbacks = Array.from({ length: 6 }, (_, index) =>
  `https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-test-${index + 1}`
);

test("accepts Gemini's six HTTPS OAuth callbacks", () => {
  assert.deepEqual(parseMcpClientRegistration({
    client_name: "Gemini Spark",
    redirect_uris: googleCallbacks,
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
  }), { name: "Gemini Spark", uris: googleCallbacks });
});

test("keeps a finite registration limit and validates every callback", () => {
  assert.equal(parseMcpClientRegistration({
    redirect_uris: Array.from({ length: 17 }, (_, index) => `https://example.com/${index}`),
  }), null);
  assert.equal(parseMcpClientRegistration({
    redirect_uris: [...googleCallbacks, "http://example.com/callback"],
  }), null);
});
