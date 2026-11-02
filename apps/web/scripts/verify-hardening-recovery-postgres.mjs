import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone disposable test. Never load .env files or accept a hosted target.
const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname, '/meadtools_premium_foundation_test');
const web = fileURLToPath(new URL('..', import.meta.url));
const migration = '20261101010000_harden_server_only_database';
const source = join(web, 'prisma/migrations', migration, 'migration.sql');
const checksum = createHash('sha256').update(readFileSync(source)).digest('hex');
assert.equal(checksum, 'f82e7537b504b374e8fe8d7bcf5ce726029ad98a7f216742a6865a1a8eed60ed');
const scratch = mkdtempSync(join(tmpdir(), 'meadtools-hardening-recovery-'));
url.pathname = '/meadtools_hardening_recovery_test';
const env = { ...process.env, DATABASE_URL: url.href, DATABASE_DIRECT_URL: url.href };
const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
function psql(sql, target = url, expected = 0) {
  const result = spawnSync('psql', ['-X', '-qAt', '--set', 'ON_ERROR_STOP=1', '--dbname', target.href],
    { input: sql, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result.stdout.trim();
}
function cli(args, expected = 0) {
  // Override only for an isolated local tool installation; CI uses its pinned CLI.
  const command = process.execPath;
  const prefix = [resolve(process.env.PRISMA_CLI ?? join(web, '../../node_modules/prisma/build/index.js'))];
  const result = spawnSync(command, [...prefix, ...args, '--schema', join(scratch, 'schema.prisma')],
    { cwd: scratch, env, encoding: 'utf8', timeout: 120_000 });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result.stderr + result.stdout;
}
function recovery(expected = 0) {
  const result = spawnSync('psql', ['-X', '--dbname', url.href, '--file', join(web, 'scripts/recover-server-only-hardening.sql')],
    { encoding: 'utf8', timeout: 40_000 });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result.stderr;
}
async function lockChat() {
  const child = spawn('psql', ['-X', '-qAt', '--set', 'ON_ERROR_STOP=1', '--dbname', url.href], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.write("BEGIN; LOCK TABLE public.chat_messages IN ACCESS SHARE MODE; SELECT 'locked';\n");
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error('Lock fixture did not start')), 5000);
    child.stdout.on('data', data => { if (data.toString().includes('locked')) { clearTimeout(timer); resolveReady(); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Lock fixture exited: ${code}`)); });
  });
  return async () => {
    const closed = new Promise(resolveClosed => child.once('exit', resolveClosed));
    child.stdin.end('ROLLBACK;\n'); await closed;
  };
}

let created = false;
try {
  psql('CREATE DATABASE meadtools_hardening_recovery_test', adminUrl); created = true;
  psql(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;`);
  writeFileSync(join(scratch, 'schema.prisma'), readFileSync(join(web, 'prisma/schema.prisma')));
  cpSync(join(web, 'prisma/migrations'), join(scratch, 'migrations'), { recursive: true });
  for (const name of readdirSync(join(scratch, 'migrations'))) {
    if (name >= migration && name !== 'migration_lock.toml') rmSync(join(scratch, 'migrations', name), { recursive: true });
  }
  cli(['migrate', 'deploy']);
  psql("INSERT INTO public.users (email) VALUES ('hardening-recovery@fixture.invalid')");
  const securitySnapshot = `SELECT json_agg(s ORDER BY s.relname) FROM
    (SELECT c.relname,c.relrowsecurity,c.relacl FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','S')) s`;
  const beforeFailure = psql(securitySnapshot);
  cpSync(join(web, 'prisma/migrations'), join(scratch, 'migrations'), { recursive: true });

  // Reproduce a real failed Prisma record using the unchanged migration.
  psql(`ALTER ROLE CURRENT_USER IN DATABASE meadtools_hardening_recovery_test SET statement_timeout='300ms'`);
  const unlock = await lockChat();
  try {
    assert.match(cli(['migrate', 'deploy'], 1), /57014|statement timeout/);
    assert.match(recovery(3), /could not obtain lock/);
  } finally { await unlock(); }
  psql('ALTER ROLE CURRENT_USER IN DATABASE meadtools_hardening_recovery_test RESET statement_timeout');
  assert.equal(psql(securitySnapshot), beforeFailure); // The failed DO did not leave earlier RLS/ACL changes.
  assert.equal(psql(`SELECT count(*) FROM public._prisma_migrations WHERE migration_name='${migration}' AND finished_at IS NULL AND rolled_back_at IS NULL`), '1');
  assert.equal(psql(`SELECT checksum FROM public._prisma_migrations WHERE migration_name='${migration}'`), checksum);
  assert.match(cli(['migrate', 'deploy'], 1), /P3009/);

  // An operator may already have completed some effects. Replaying is safe.
  psql(`ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.chat_messages FROM anon;
    ALTER FUNCTION public.prevent_credit_ledger_mutation() SET search_path=pg_catalog;`);
  const before = psql(`SELECT relrowsecurity FROM pg_class WHERE oid='public.users'::regclass`);
  // If the final ALTER fails, the wrapper must roll back all prior effects.
  psql('ALTER FUNCTION public.prevent_credit_ledger_mutation() RENAME TO recovery_hidden_function');
  assert.match(recovery(3), /does not exist/);
  assert.equal(psql(`SELECT relrowsecurity FROM pg_class WHERE oid='public.users'::regclass`), before);
  assert.equal(psql(`SELECT has_table_privilege('authenticated','public.chat_messages','SELECT')`), 't');
  psql('ALTER FUNCTION public.recovery_hidden_function() RENAME TO prevent_credit_ledger_mutation');
  recovery(); recovery(); // Successful completion is idempotent.
  assert.equal(psql("SELECT count(*) FROM public.users WHERE email='hardening-recovery@fixture.invalid'"), '1');
  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.users', url, 3), '');
  assert.match(cli(['migrate', 'deploy'], 1), /P3009/); // SQL alone does not repair history.
  cli(['migrate', 'resolve', '--applied', migration]);
  cli(['migrate', 'deploy']); cli(['migrate', 'status']);
  assert.equal(psql(`SELECT count(*) FROM public._prisma_migrations WHERE migration_name='${migration}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum='${checksum}'`), '1');
  assert.equal(psql(`SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`), '0');
  assert.equal(psql(`SELECT count(*) FROM public._prisma_migrations WHERE migration_name='20261101020000_remove_unused_pgjwt' AND finished_at IS NOT NULL`), '1');
  assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'), checksum);
  console.log('Verified lock timeout, rollback, partial-state replay, idempotency, Prisma failed-history recovery, checksums, and subsequent migration.');
} finally {
  rmSync(scratch, { recursive: true, force: true });
  if (created) psql('DROP DATABASE meadtools_hardening_recovery_test', adminUrl);
}
