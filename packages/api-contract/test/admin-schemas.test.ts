import assert from "node:assert/strict";
import test from "node:test";
import {
  chatAccessStatusResponseSchema,
  createChatAccessGrantRequestBodySchema,
  createChatCreditGrantRequestBodySchema,
  creditPaymentRecoveryAdministrationResponseSchema,
  resolveCreditPaymentRecoveryRequestBodySchema,
  updateChatAccessAdministrationRequestBodySchema,
  adminChatUsageQueryParamsSchema,
  adminChatUsageReportResponseSchema,
  adminAuthErrorResponseSchema,
  adminRecipesQueryParamsSchema,
  adminUserResponseSchema,
  updateAdminUserRequestBodySchema,
} from "../src/zod/admin";

test("admin schemas preserve query and partial update shapes", () => {
  assert.equal(
    adminRecipesQueryParamsSchema.safeParse({
      page: "1",
      limit: "20",
      query: "traditional",
    }).success,
    true,
  );
  assert.equal(
    updateAdminUserRequestBodySchema.safeParse({ updateToken: true }).success,
    true,
  );
});

test("admin user schema preserves nullable authentication fields", () => {
  assert.equal(
    adminUserResponseSchema.safeParse({
      id: 1,
      email: "admin@example.com",
      password: null,
      google_id: null,
      role: "admin",
      hydro_token: null,
      public_username: null,
      google_avatar_url: null,
      show_google_avatar: false,
      active: true,
    }).success,
    true,
  );
});

test("admin errors retain exact public literals", () => {
  assert.equal(
    adminAuthErrorResponseSchema.safeParse({
      error: "Forbidden – admin access required.",
    }).success,
    true,
  );
  assert.equal(
    adminAuthErrorResponseSchema.safeParse({ error: "Forbidden" }).success,
    false,
  );
});

test("chat beta access schemas preserve explicit grants and the global rollout mode", () => {
  assert.deepEqual(
    updateChatAccessAdministrationRequestBodySchema.parse({
      mode: "all_active_users",
    }),
    { mode: "all_active_users" },
  );
  assert.deepEqual(
    createChatAccessGrantRequestBodySchema.parse({ userId: 24 }),
    { userId: 24 },
  );
  assert.deepEqual(
    createChatCreditGrantRequestBodySchema.parse({
      userId: 24,
      creditAmount: 2_500,
    }),
    { userId: 24, creditAmount: 2_500 },
  );
  assert.deepEqual(
    chatAccessStatusResponseSchema.parse({
      chatEnabled: true,
      mode: "beta_allowlist",
      granted: true,
      paymentRestricted: false,
    }),
    {
      chatEnabled: true,
      mode: "beta_allowlist",
      granted: true,
      paymentRestricted: false,
    },
  );
  assert.equal(
    createChatAccessGrantRequestBodySchema.safeParse({ userId: 0 }).success,
    false,
  );
  assert.equal(
    createChatCreditGrantRequestBodySchema.safeParse({
      userId: 24,
      creditAmount: 0,
    }).success,
    false,
  );
  assert.equal(
    updateChatAccessAdministrationRequestBodySchema.safeParse({
      mode: "everyone",
    }).success,
    false,
  );
});

test("payment recovery schemas preserve immutable recovery details and operator resolution", () => {
  const recoveryId = "41efce94-d0c6-4d17-b8fd-aedb7dbe3f6c";
  assert.equal(
    creditPaymentRecoveryAdministrationResponseSchema.safeParse({
      recoveries: [
        {
          id: recoveryId,
          kind: "stripe_refund",
          status: "review_required",
          externalReference: "re_123",
          amountCents: 540,
          currency: "usd",
          creditDelta: -5_000,
          resolutionCreditDelta: null,
          resolutionNote: null,
          createdAt: "2026-08-09T00:00:00.000Z",
          resolvedAt: null,
          userId: 24,
          email: "user@example.com",
          publicUsername: null,
          paymentRestricted: true,
          stripeDashboardUrl:
            "https://dashboard.stripe.com/test/disputes/du_123",
          packId: "starter",
          packCredits: 5_000,
        },
      ],
    }).success,
    true,
  );
  assert.deepEqual(
    resolveCreditPaymentRecoveryRequestBodySchema.parse({
      creditDelta: 0,
      note: "Refund reconciled after support review.",
      releaseChat: true,
    }),
    {
      creditDelta: 0,
      note: "Refund reconciled after support review.",
      releaseChat: true,
    },
  );
});

test("chat usage reporting schemas accept settled ledger-backed operational data", () => {
  assert.deepEqual(
    adminChatUsageQueryParamsSchema.parse({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-16T00:00:00.000Z",
      status: "completed",
      page: "2",
      limit: "25",
    }),
    {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-16T00:00:00.000Z",
      status: "completed",
      page: 2,
      limit: 25,
    },
  );

  const metric = {
    requestCount: 1,
    completedTurns: 1,
    failedTurns: 0,
    pendingTurns: 0,
    unpricedCompletedTurns: 0,
    providerCalls: 2,
    inputTokens: 1_200,
    cachedInputTokens: 800,
    outputTokens: 200,
    totalTokens: 1_400,
    chargedCredits: 35,
    providerCostPicousd: "12000000000",
    creditEquivalentPicousd: "35000000000",
    estimatedSpreadPicousd: "23000000000",
  };
  assert.equal(
    adminChatUsageReportResponseSchema.safeParse({
      filters: {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-16T00:00:00.000Z",
        environment: "production",
        model: "gpt-5.4-mini",
        status: "completed",
        userId: null,
        query: null,
        page: 1,
        limit: 25,
      },
      summary: {
        ...metric,
        activeUsers: 1,
        paymentRestrictedAccounts: 0,
        pendingPaymentRecoveries: 0,
      },
      daily: [{ ...metric, day: "2026-08-15" }],
      models: [{ ...metric, provider: "openai", model: "gpt-5.4-mini" }],
      users: [
        {
          ...metric,
          userId: 24,
          email: "user@example.com",
          publicUsername: "meadmaker",
          active: true,
          chatEnabled: true,
          paymentRestricted: false,
          availableCredits: 965,
          lastActivityAt: "2026-08-15T10:00:00.000Z",
        },
      ],
      totalUsers: 1,
    }).success,
    true,
  );
  assert.equal(
    adminChatUsageQueryParamsSchema.safeParse({ status: "unknown" }).success,
    false,
  );
});
