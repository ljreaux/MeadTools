import assert from "node:assert/strict";
import prisma from "../prisma.ts";
import { getCreditActivityPage } from "../db/credit-history.ts";
import { creditActivityResponseSchema } from "@meadtools/api-contract/credits";

// Replace the only database read before invoking the production history mapper.
// The child process has only dummy credentials and never connects to a database.
const cases = [
  { entryTypes: ["grant"], sources: ["stripe-premium"], kind: "grant", grantSource: "premium", credits: 1_000 },
  { entryTypes: ["grant"], sources: ["kofi-premium"], kind: "grant", grantSource: "premium", credits: 1_000 },
  { entryTypes: ["grant"], sources: [null], kind: "grant", grantSource: "beta", credits: 500 },
  { entryTypes: ["grant"], sources: null, kind: "grant", grantSource: "beta", credits: 500 },
  { entryTypes: ["grant"], sources: ["unrecognized"], kind: "grant", grantSource: "beta", credits: 500 },
  { entryTypes: ["purchase"], sources: null, kind: "purchase", grantSource: null, credits: 5_000 },
  { entryTypes: ["refund"], sources: null, kind: "refund", grantSource: null, credits: -5_000 },
  { entryTypes: ["reservation", "settlement"], sources: null, kind: "usage", grantSource: null, credits: -50 },
  { entryTypes: ["adjustment"], sources: null, kind: "adjustment", grantSource: null, credits: 100 },
];
const rows = cases.map((item, index) => ({
  operation_id: `01234567-89ab-cdef-0123-${String(index).padStart(12, "0")}`,
  last_occurred_at: new Date("2026-10-12T12:00:00.000Z"),
  credits_delta: BigInt(item.credits),
  entry_types: item.entryTypes,
  grant_sources: item.sources,
  source_amount_cents: item.kind === "purchase" ? 500 : null,
  source_currency: item.kind === "purchase" ? "usd" : null,
}));
prisma.$queryRaw = async (query) => {
  assert.ok(query.values.includes(42), "history remains scoped to the signed-in account");
  return rows;
};
const page = await getCreditActivityPage({ userId: 42 });
assert.equal(page.nextCursor, null);
for (const [index, activity] of page.activities.entries()) {
  const expected = cases[index];
  assert.equal(activity.kind, expected.kind);
  assert.equal(activity.grantSource, expected.grantSource);
  assert.equal(activity.creditsDelta, expected.credits);
  assert.equal(activity.operationId, rows[index].operation_id);
  assert.equal("grant_sources" in activity, false, "internal metadata sources are not exposed");
}
creditActivityResponseSchema.parse({
  availableCredits: 1_000,
  purchasesEnabled: true,
  activities: page.activities.map((activity) => ({ ...activity, occurredAt: activity.occurredAt.toISOString() })),
  nextCursor: page.nextCursor,
});
await prisma.$disconnect();
