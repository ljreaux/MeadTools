import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

// This creates only a dedicated database on the disposable CI/local test server.
// It never reads application environment files or connects to a hosted database.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
assert.equal(url.pathname, "/meadtools_premium_foundation_test");
url.pathname = "/postgres";
const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  for (const role of ["anon", "authenticated", "meadtools_fixture_app"]) {
    const exists = await admin.$queryRaw`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
    if (!exists.length) await admin.$executeRawUnsafe(
      `CREATE ROLE ${role} NOLOGIN${role === "meadtools_fixture_app" ? " BYPASSRLS" : ""}`,
    );
  }
  await admin.$executeRawUnsafe("CREATE DATABASE meadtools_supabase_hardening_test");
} finally {
  await admin.$disconnect();
}
url.pathname = "/meadtools_supabase_hardening_test";
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  await db.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO anon, authenticated, meadtools_fixture_app");
  // Reproduce the old project's defaults, plus an independent server role.
  for (const object of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
    await db.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ${object} TO anon, authenticated, meadtools_fixture_app`);
  }
  const migration = spawnSync("npx", ["prisma", "migrate", "deploy", "--config", "prisma.test.config.ts"], {
    env: { ...process.env, DATABASE_URL: url.toString(), DATABASE_DIRECT_URL: url.toString() },
    encoding: "utf8", timeout: 120_000,
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const [{ unprotected }] = await db.$queryRaw`
    SELECT count(*)::int AS unprotected FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity`;
  assert.equal(unprotected, 0);
  const [{ leaked }] = await db.$queryRaw`
    SELECT count(*)::int AS leaked FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('anon'),('authenticated')) roles(name)
    WHERE n.nspname='public' AND c.relkind='r'
      AND has_table_privilege(roles.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`;
  assert.equal(leaked, 0);
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE anon");
    await assert.rejects(tx.users.count(), /permission denied/i);
  });
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE meadtools_fixture_app");
    const row = await tx.users.create({ data: { email: "server-access@fixture.invalid" } });
    assert.equal((await tx.users.findUniqueOrThrow({ where: { id: row.id } })).email,
      "server-access@fixture.invalid");
  });
  await db.$executeRawUnsafe("CREATE TABLE public.future_access_fixture (id serial PRIMARY KEY)");
  await db.$executeRawUnsafe("CREATE FUNCTION public.future_function_fixture() RETURNS int LANGUAGE sql AS 'SELECT 1'");
  for (const role of ["anon", "authenticated"]) {
    const [permissions] = await db.$queryRaw`
      SELECT has_table_privilege(${role},'public.future_access_fixture','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS table_access,
        has_sequence_privilege(${role},'public.future_access_fixture_id_seq','USAGE,SELECT,UPDATE') AS sequence_access,
        has_function_privilege(${role},'public.future_function_fixture()','EXECUTE') AS function_access,
        has_function_privilege(${role},'public.prevent_credit_ledger_mutation()','EXECUTE') AS ledger_function_access`;
    assert.deepEqual(permissions, { table_access: false, sequence_access: false,
      function_access: false, ledger_function_access: false });
  }
  const [ledger] = await db.$queryRaw`
    SELECT proconfig,prosecdef FROM pg_proc WHERE oid='public.prevent_credit_ledger_mutation()'::regprocedure`;
  assert.deepEqual(ledger.proconfig, ["search_path=pg_catalog"]);
  assert.equal(ledger.prosecdef, false);
  assert.equal((await db.$queryRaw`SELECT 1 FROM pg_extension WHERE extname='pgjwt'`).length, 0);
  console.log("Verified server access, API denial, RLS, future grants, fixed trigger path, and absent pgjwt on disposable PostgreSQL.");
} finally {
  await db.$disconnect();
}
