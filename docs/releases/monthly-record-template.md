# Monthly release record template

Copy to `docs/releases/YYYY-MM.md` during preparation. This is an internal record,
not a public announcement. Larry Reaux owns release scope and approval; the cloud
agent prepares and verifies work. The German reviewer handles only translation
approval under the translation workflow.

- Cycle / target date / actual date:
- Last verified production tag and SHA:
- Reviewed preview head / main base:
- Candidate PR and linked feature/hotfix PRs:
- Internal product notes: `docs/releases/YYYY-MM.json`
- Web / Mobile / Chat / API: include, defer, or no change; availability evidence:
- Mobile production build: skip (default), or separately approved run:
- Chatbot status: beta unless separately approved otherwise:
- Larry's exact-SHA approval link and time:
- CI / GitHub required-review decision / gate run:
- Promotion merge and production deployment SHA/link:
- Applied migrations and rollback compatibility:
- Smoke checks: sign-in, recipes, brew tracking, changed features, release notes:
- Production Mobile build/store evidence, or skipped:
- Publication approval link (website publication starts opted-in email):
- Dated website notes URL and publication PR:
- GitHub tag `release-YYYY-MM-DD`, release URL, verified deployment SHA:
- Aggregate email outcome / ambiguous failures requiring manual review:
- Correction/rollback decisions and evidence:
- Deferred work / blockers / no-change decision:

Order: prepare internal drafts → review and approve exact promotion scope/SHA →
arm auto-merge → GitHub gate → merge/deploy → smoke checks and availability →
publication approval → reviewed dated-note publication → GitHub Release → verify
automatic email outcome. Never send a second manual email because the delivery
outcome is uncertain. Complete publication through the documented gate/window;
if blocked, retain drafts and report it rather than bypassing controls.
