-- MeadTools authenticates and authorizes through its server, using Prisma.
-- Supabase Data API roles must not access application tables or routines.
-- Keep owners and the server role working; do not FORCE RLS or add auth.uid policies.
DO $$
DECLARE
  object_record record;
  api_role text;
  creator text;
BEGIN
  FOR object_record IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', object_record.relname);
  END LOOP;

  -- PUBLIC is a pseudo-role, and its grants are inherited by all API roles.
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
  FOR object_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC', object_record.signature);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I', object_record.signature, api_role);
    END LOOP;
  END LOOP;

  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
  END LOOP;

  -- Cover the migration role and postgres when the migration role can act as it.
  -- Supabase-managed roles are deliberately not modified. Dashboard automatic
  -- exposure must remain off for objects subsequently created by managed roles.
  FOR creator IN
    SELECT rolname FROM pg_roles
    WHERE rolname = current_user
      OR (rolname = 'postgres' AND pg_has_role(current_user, oid, 'MEMBER'))
  LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', creator);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', creator);
    -- Function EXECUTE is granted to PUBLIC globally, so a schema-only revoke
    -- cannot remove it. Application functions must opt in to public execution.
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', creator);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', creator, api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', creator, api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', creator, api_role);
    END LOOP;
  END LOOP;
END $$;

ALTER FUNCTION public.prevent_credit_ledger_mutation() SET search_path = pg_catalog;
