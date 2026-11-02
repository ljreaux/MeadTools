import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { registerHooks } from "node:module";
import prisma from "../../prisma.ts";

// Match Next's CJS-provider interop without starting a Google sign-in flow.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "next-auth/providers/google") return {
    url: "data:text/javascript,export default function GoogleProvider() { return {}; }",
    shortCircuit: true,
  };
  return nextResolve(specifier, context);
} });
const { generateBrewQr } = await import("../generateBrewQr.ts");
hooks.deregister();

// Only dummy auth and database data exist in this isolated offline process.
const brewId = "11111111-1111-4111-8111-111111111111";
const bearer = jwt.sign({ id: 42 }, process.env.ACCESS_TOKEN_SECRET);
let owner = true;
let active = true;
let restricted = false;
let paidThrough = new Date(Date.now() + 86_400_000);
let ownerReads = 0;
let premiumReads = 0;
prisma.users.findUnique = async ({ where, select }) => {
  assert.deepEqual(where, { id: 42 });
  if (!select) return { id: 42 };
  premiumReads++;
  return {
    active,
    credit_account: { payment_restricted_at: restricted ? new Date() : null },
    premium_memberships: [{ source: "manual", paid_through: paidThrough, revoked_at: null }],
  };
};
prisma.brews.findFirst = async (args) => {
  ownerReads++;
  assert.deepEqual(args, { where: { id: brewId, user_id: 42 }, select: { id: true } });
  return owner ? { id: brewId } : null;
};

assert.deepEqual(await generateBrewQr("../invalid", bearer), { error: "unavailable" });
assert.equal(ownerReads, 0);
assert.deepEqual(await generateBrewQr(brewId, "invalid\r\nheader"), { error: "unavailable" });
const generated = await generateBrewQr(brewId, bearer);
assert.ok("svg" in generated);
assert.equal(generated.url, `https://qr-fixture.meadtools.com/brews/${brewId}`);
owner = false;
const beforeUnauthorized = premiumReads;
assert.deepEqual(await generateBrewQr(brewId, bearer), { error: "unavailable" });
assert.equal(premiumReads, beforeUnauthorized);
owner = true;
paidThrough = new Date(Date.now() - 1);
assert.deepEqual(await generateBrewQr(brewId, bearer), { error: "premiumRequired" });
paidThrough = new Date(Date.now() + 86_400_000);
restricted = true;
assert.deepEqual(await generateBrewQr(brewId, bearer), { error: "premiumRequired" });
restricted = false;
active = false;
assert.deepEqual(await generateBrewQr(brewId, bearer), { error: "premiumRequired" });
active = true;
process.env.PREMIUM_ACCESS_ENABLED = "false";
assert.deepEqual(await generateBrewQr(brewId, bearer), { error: "premiumRequired" });
// No Next request/session exists here: a missing credential must fail closed.
const beforeAnonymous = ownerReads;
assert.deepEqual(await generateBrewQr(brewId, null), { error: "unavailable" });
assert.equal(ownerReads, beforeAnonymous);
await prisma.$disconnect();
