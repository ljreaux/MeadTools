-- Run only after the separate production recovery approval in the runbook.
-- psql -X --set ON_ERROR_STOP=1 --file scripts/recover-server-only-hardening.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';

-- Avoid queuing the original all-table ALTERs behind a busy application table.
-- NOWAIT aborts the entire transaction, releasing locks already acquired.
DO $$
DECLARE object_record record;
BEGIN
  FOR object_record IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
    ORDER BY c.oid
  LOOP
    EXECUTE format('LOCK TABLE ONLY public.%I IN ACCESS EXCLUSIVE MODE NOWAIT', object_record.relname);
  END LOOP;
END $$;

-- Preserve the published migration byte-for-byte, including its final ALTER.
\ir ../prisma/migrations/20261101010000_harden_server_only_database/migration.sql
\ir verify-server-only-hardening.sql
COMMIT;
-- This intentionally does not modify _prisma_migrations or run later migrations.
