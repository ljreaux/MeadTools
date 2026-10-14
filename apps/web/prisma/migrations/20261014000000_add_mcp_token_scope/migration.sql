-- Existing personal tokens keep their original seven-tool capability.
ALTER TABLE "mcp_access_tokens" ADD COLUMN "scope" VARCHAR(128) NOT NULL DEFAULT 'mcp:tools';
