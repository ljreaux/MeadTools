-- Read-only assertions, also included before the recovery transaction commits.
\set ON_ERROR_STOP on
DO $$
DECLARE creator oid; api_role record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
        AND d.objid=c.oid AND d.deptype='e')
  ) THEN RAISE EXCEPTION 'Application table RLS is incomplete'; END IF;

  -- Check direct PUBLIC ACLs, including views and sequences covered by REVOKE ALL.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
      LATERAL aclexplode(c.relacl) a
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S') AND a.grantee=0
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE n.nspname='public' AND p.prokind='f' AND a.grantee=0
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
        AND d.objid=p.oid AND d.deptype='e')
  ) THEN RAISE EXCEPTION 'PUBLIC application privileges remain'; END IF;

  -- Effective checks catch inherited grants too; stop for review rather than
  -- silently changing Supabase-managed role memberships or unrelated grants.
  FOR api_role IN SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND (
        (c.relkind IN ('r','p','v','m','f') AND has_table_privilege(api_role.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
        OR (c.relkind='S' AND has_sequence_privilege(api_role.oid,c.oid,'USAGE,SELECT,UPDATE')))
    ) OR EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND has_function_privilege(api_role.oid,p.oid,'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
          AND d.objid=p.oid AND d.deptype='e')
    ) THEN RAISE EXCEPTION 'Effective application privileges remain for %',api_role.rolname; END IF;
  END LOOP;

  FOR creator IN SELECT oid FROM pg_roles WHERE rolname=current_user
    OR (rolname='postgres' AND pg_has_role(current_user,oid,'MEMBER')) LOOP
    -- The migration changes schema defaults for relations and sequences and
    -- global + schema defaults for functions. A missing global ACL uses the
    -- built-in function default (EXECUTE to PUBLIC), which must also fail.
    IF EXISTS (
      SELECT 1 FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole=creator AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype IN ('r','S','f')
        AND (a.grantee=0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated')))
    ) OR EXISTS (
      SELECT 1 FROM aclexplode(coalesce((SELECT d.defaclacl FROM pg_default_acl d
        WHERE d.defaclrole=creator AND d.defaclnamespace=0 AND d.defaclobjtype='f'),acldefault('f',creator))) a
      WHERE a.grantee=0
    ) THEN RAISE EXCEPTION 'Unsafe default privileges for creator %',creator::regrole; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE oid='public.prevent_credit_ledger_mutation()'::regprocedure
      AND proconfig @> ARRAY['search_path=pg_catalog'])
  THEN RAISE EXCEPTION 'Ledger function search_path is incomplete'; END IF;
END $$;
