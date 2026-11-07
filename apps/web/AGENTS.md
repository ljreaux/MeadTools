<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web app (`apps/web`)

The repository-wide rules in the root [`AGENTS.md`](../../AGENTS.md) apply
here too; this file only adds web-specific guidance.

## Next.js docs

- In this workspace the `next` package is hoisted, so the version-matched docs
  referenced above are at the repository root in
  `node_modules/next/dist/docs/`. Read the relevant guide there before
  Next.js work.
- Do not use or recreate the old `.next-docs/` copy or the
  `npx @next/codemod agents-md` docs index; the installed `next` package now
  ships its own docs.

## Maintaining the Next.js block

- The block between the `nextjs-agent-rules` markers is owned by Next.js.
  `next dev` rewrites it in place when an AI coding agent runs the dev server
  and the block is missing or differs from the installed Next.js version.
- Do not hand-edit text between the markers. Put web guidance below the
  block; Next.js preserves everything outside the markers.
- `next dev` only writes the block when it detects an AI coding agent, so
  after a Next.js upgrade the change appears the first time an agent starts
  the dev server. Commit that block change with the upgrade (or in a small
  follow-up) so the tree stays clean for everyone.
- `next dev` would also create `CLAUDE.md` if neither file existed; keep the
  tracked `CLAUDE.md` as the one-line `@AGENTS.md` import.
