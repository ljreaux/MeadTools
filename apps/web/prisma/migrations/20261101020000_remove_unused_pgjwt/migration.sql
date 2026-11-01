-- Application JWTs are handled by NextAuth/jsonwebtoken, not pgjwt.
-- No CASCADE: fail safely if a database object depends on this extension.
-- The extension is already absent on newer Supabase projects and local Postgres.
DROP EXTENSION IF EXISTS pgjwt;
