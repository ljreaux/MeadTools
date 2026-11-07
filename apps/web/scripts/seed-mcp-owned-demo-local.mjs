// Additive local fixture: one synthetic, non-admin review account that owns one
// fictional private brew for demonstrating MCP owned-record reads.
// It never resets data, never touches other accounts and never prints credentials.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, writeSync, closeSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
loadEnvConfig(appDirectory, true, { info() {}, error() {} });

function assertLocalFixtureTarget() {
  assert.notEqual(process.env.NODE_ENV, "production", "Local fixtures cannot run in production.");
  assert.equal(
    process.env.ALLOW_MCP_OWNED_DEMO_FIXTURE,
    "true",
    "Set ALLOW_MCP_OWNED_DEMO_FIXTURE=true for this additive local seed.",
  );
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Only a loopback database is allowed.");
  assert.ok(
    ["meadtools_dev", "meadtools_test"].includes(url.pathname.slice(1)),
    "Only approved local development/test databases are allowed.",
  );
}
assertLocalFixtureTarget();

const { default: bcrypt } = await import("bcrypt");
const { default: db } = await import("../lib/prisma.ts");
const { createRecipe } = await import("../lib/db/recipes.ts");
const { createBrewForApp, patchBrewMetadata, createBrewEntryForApp } = await import("../lib/db/brews.ts");
const { createAccountReadAdapter } = await import("../lib/account-read-adapter.ts");
const { buildRecipeDraft } = await import("@meadtools/recipe-workflows");
const { entryPayload } = await import("@meadtools/brew-domain");
const { executeMcpAgentTool } = await import("@meadtools/recipe-agent");

const email = "mcp-owned-review-demo@meadtools.test";
const accountLabel = "Synthetic MCP review demo";
const brewName = "Marketplace Review Traditional";
const recipeName = "Marketplace Review Traditional — synthetic recipe";
const credentialFile =
  process.env.MCP_OWNED_DEMO_CREDENTIAL_FILE ??
  join(homedir(), ".local/share/meadtools-mcp/owned-demo-account.local");
const uuid = (n) => `47700000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const startDate = "2026-09-12T15:00:00.000Z";
const fgDate = "2026-10-10T15:00:00.000Z";

/** Write a new random password to a private file; the value is never printed. */
function issuePassword() {
  assert.ok(!existsSync(credentialFile), "Refusing to overwrite an existing local credential file.");
  const password = randomBytes(18).toString("base64url");
  mkdirSync(dirname(credentialFile), { recursive: true, mode: 0o700 });
  const fd = openSync(credentialFile, "wx", 0o600);
  writeSync(fd, `# Local-only synthetic MeadTools review account. Do not commit or share.\nemail=${email}\npassword=${password}\n`);
  closeSync(fd);
  return password;
}

async function ensureAccount() {
  const existing = await db.users.findUnique({
    where: { email },
    select: { id: true, public_username: true, role: true, google_id: true, active: true },
  });
  if (existing) {
    assert.equal(existing.public_username, accountLabel, "The reserved demo email belongs to a different account.");
    assert.equal(existing.role, "user", "The demo account must remain a non-admin user.");
    assert.equal(existing.google_id, null, "The demo account must not be linked to Google.");
    assert.equal(existing.active, true, "The demo account is inactive; inspect it manually rather than reactivating automatically.");
    assert.ok(existsSync(credentialFile), `Demo account exists but its credential file is missing: ${credentialFile}`);
    return { id: existing.id, created: false };
  }
  const password = await bcrypt.hash(issuePassword(), 10);
  const user = await db.users.create({
    data: { email, password, role: "user", public_username: accountLabel, active: true, show_google_avatar: false },
    select: { id: true },
  });
  return { id: user.id, created: true };
}

/** Same calendar-month manual grant as the normal local seed; no billing provider is involved. */
async function ensureManualPremium(userId) {
  const now = new Date();
  const paidThrough = new Date(now);
  const day = paidThrough.getUTCDate();
  paidThrough.setUTCDate(1);
  paidThrough.setUTCMonth(paidThrough.getUTCMonth() + 1);
  const last = new Date(Date.UTC(paidThrough.getUTCFullYear(), paidThrough.getUTCMonth() + 1, 0)).getUTCDate();
  paidThrough.setUTCDate(Math.min(day, last));
  const existing = await db.premium_memberships.findUnique({
    where: { user_id_source: { user_id: userId, source: "manual" } },
    select: { id: true, paid_through: true, revoked_at: true },
  });
  if (existing && !existing.revoked_at && existing.paid_through > now) return "kept";
  if (existing) {
    await db.premium_memberships.update({
      where: { id: existing.id },
      data: { paid_through: paidThrough, revoked_at: null },
    });
    return "renewed";
  }
  await db.premium_memberships.create({ data: { user_id: userId, source: "manual", paid_through: paidThrough } });
  return "created";
}

async function ensureRecipe(userId) {
  const existing = await db.recipes.findMany({ where: { user_id: userId, name: recipeName }, select: { id: true } });
  assert.ok(existing.length <= 1, "Multiple demo recipes exist; inspect them manually.");
  if (existing.length) return { id: existing[0].id, created: false };
  const yeast = await db.yeasts.findFirst({
    where: { brand: "Lalvin", name: "71B" },
    select: { id: true, brand: true, name: true, nitrogen_requirement: true },
  });
  assert.ok(yeast, "Seed the local yeast catalog first.");
  const draft = buildRecipeDraft({
    name: recipeName,
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.998,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Water", role: "fill_liquid" },
    ],
    nutrients: {
      enabled: true,
      yeastBrand: yeast.brand,
      yeastStrain: yeast.name,
      yeastId: yeast.id,
      nitrogenRequirement: yeast.nitrogen_requirement,
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm",
    },
    stabilizers: { enabled: false },
  });
  assert.equal(draft.status, "recipe", "The shared recipe engine must complete the demo recipe.");
  const recipe = await createRecipe({
    userId,
    name: recipeName,
    dataV2: draft.recipeData,
    recipeData: "{}",
    yanContribution: "{}",
    nutrientData: "{}",
    private: true,
  });
  return { id: recipe.id, created: true };
}

async function ensureBrew(userId, recipeId) {
  const existing = await db.brews.findMany({
    where: { user_id: userId, name: brewName },
    select: { id: true, stage: true, public: true },
  });
  assert.ok(existing.length <= 1, "Multiple demo brews exist; inspect them manually.");
  let brew = existing[0];
  let created = false;
  if (!brew) {
    brew = await createBrewForApp(userId, { recipe_id: recipeId, name: brewName, current_volume_liters: 3.785 });
    created = true;
  }
  assert.equal(brew.public, false, "The owned demo brew must stay private.");
  if (brew.stage === "PLANNED") {
    await patchBrewMetadata(userId, brew.id, {
      start_date: startDate,
      stage: "PRIMARY",
      stage_change_datetime: startDate,
    });
  }
  const entries = [
    {
      ...entryPayload.note(
        "Fictional brewing log created for local MeadTools marketplace review. Not a real fermentation, tasting or process recommendation.",
        "Synthetic review fixture",
        null,
        startDate,
      ),
      client_entry_id: uuid(1),
    },
    {
      ...entryPayload.gravity(1.1, "Synthetic measured must gravity before yeast pitch.", {
        readingRole: "OG",
        source: "measured",
        datetime: "2026-09-12T15:05:00.000Z",
      }),
      client_entry_id: uuid(2),
    },
    {
      ...entryPayload.gravity(1.0, "Synthetic measured fermentation final gravity. One reading does not establish stability.", {
        readingRole: "FG",
        source: "measured",
        datetime: fgDate,
      }),
      client_entry_id: uuid(3),
    },
  ];
  let added = 0;
  for (const entry of entries) {
    const previous = await db.brew_entries.findUnique({
      where: { id: entry.client_entry_id },
      select: { brew_id: true },
    });
    assert.ok(!previous || previous.brew_id === brew.id, "A demo entry ID belongs to another brew.");
    if (previous) continue;
    await createBrewEntryForApp(userId, brew.id, entry);
    added++;
  }
  return { id: brew.id, created, added };
}

async function verify(userId, brewId) {
  const adapter = createAccountReadAdapter(userId);
  const read = (name, input) => executeMcpAgentTool(name, input, { accountReadAdapter: adapter });
  const list = await read("list_brews", { query: brewName });
  assert.equal(list.status, "ok", "list_brews must succeed for the demo account.");
  const match = list.result.items.filter((b) => b.untrustedName === brewName);
  assert.equal(match.length, 1, "list_brews must return exactly one demo brew.");
  const listedId = match[0].id;
  assert.equal(listedId, brewId);
  const detail = await read("get_brew", { id: listedId });
  assert.equal(detail.status, "ok", "get_brew must succeed with the listed UUID.");
  const timeline = await read("get_brew_timeline", { id: listedId });
  assert.equal(timeline.status, "ok", "get_brew_timeline must succeed with the listed UUID.");
  const gravities = timeline.result.items.filter((e) => e.type === "GRAVITY");
  const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 1e-4;
  const og = gravities.filter((e) => near(e.gravity, 1.1) && e.readingRole === "OG");
  const fg = gravities.filter((e) => near(e.gravity, 1.0) && e.readingRole === "FG");
  assert.equal(og.length, 1, "Exactly one OG 1.100 reading expected.");
  assert.equal(fg.length, 1, "Exactly one FG 1.000 reading expected.");
  assert.notEqual(og[0].datetime.slice(0, 10), fg[0].datetime.slice(0, 10), "OG and FG must be on distinct dates.");
  const sensors = await read("get_brew_sensor_history", { id: listedId });
  return {
    listedId,
    appUrl: detail.result.appUrl ?? match[0].appUrl ?? null,
    readings: gravities.map((e) => ({ datetime: e.datetime, gravity: e.gravity, role: e.readingRole ?? null })),
    timelineTypes: timeline.result.items.map((e) => e.type),
    sensorItems: sensors.status === "ok" ? (sensors.result.items?.length ?? 0) : sensors.status,
  };
}

try {
  const account = await ensureAccount();
  const premium = await ensureManualPremium(account.id);
  const recipe = await ensureRecipe(account.id);
  const brew = await ensureBrew(account.id, recipe.id);
  const check = await verify(account.id, brew.id);
  console.log(JSON.stringify({
    account: { id: account.id, email, label: accountLabel, role: "user", created: account.created },
    credentialFile,
    manualPremium: premium,
    recipe: { id: recipe.id, name: recipeName, private: true, created: recipe.created },
    brew: { id: brew.id, name: brewName, private: true, created: brew.created, entriesAdded: brew.added },
    verification: check,
  }, null, 2));
} finally {
  await db.$disconnect();
}
