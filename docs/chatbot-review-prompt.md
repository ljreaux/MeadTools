# Hosted chatbot review prompt

Perform a read-only code review of the hosted-chatbot feature work in this repository.

Use [the canonical hosted-chatbot architecture](hosted-chatbot-architecture.md)
as the current design reference. Dated plans, review findings, and evaluator
exports are historical context only and must be verified against code/schema.

First, read AGENTS.md completely. Do not start development servers, do not call the real model provider, do not inspect .env files or credentials, and do not modify application source code. Treat the current branch as potentially dirty: preserve all existing changes.

Review the complete chatbot-related implementation against its merge base with `preview` (or, if that is unavailable, explain the comparison point you used). Include all relevant changes across:

- chat domain, agent policy, workflows, and MeadTools tool integration
- web chat UI, persistence, billing/credits, admin beta access, and Stripe boundaries
- API routes and generated API-contract/OpenAPI artifacts
- Prisma schema and migrations
- access control, data ownership, thread retention, reservations/reconciliation, and abuse/cost safeguards
- translations, tests, docs, and ignored evaluator artifacts

Pay special attention to:

- preserving user-supplied recipe inputs over catalog defaults, including punctuation variants such as `Opti-Red`
- secondary ingredients always being unfermented in MeadTools
- ingredient/additive/stabilizer separation
- exact MeadTools calculator and wiki behavior versus invented advice
- named yeast lookup, unknown yeast behavior, and nutrient-plan retention
- target OG versus target ABV semantics
- sparkling + stabilization + backsweetening packaging safety
- repeat-question loops, especially the known traditional-mead “single adjustable fermentable” confirmation regression
- credit settlement accuracy, per-turn rounding effects, Stripe webhook/refund/dispute handling, and authorization boundaries
- reusable architecture: domain behavior must not be trapped in the web UI

Run only safe local static checks/tests that do not require provider credentials or network spend. Clearly distinguish verified facts from inferences.

Create a review document at:

`docs/reviews/hosted-chatbot-manual-review.md`

The document must include:

1. Executive summary and readiness assessment.
2. Findings ranked Critical / High / Medium / Low, each with:
   - exact file and line references
   - concrete impact
   - evidence
   - recommended remediation
3. A separate “manual reviewer checklist” written for me, including:
   - how to inspect each risky flow in the UI
   - what database/ledger state to verify
   - what webhook/payment behavior to verify in Stripe test mode
   - what evaluator prompts to manually run
   - what should block merge or beta release
4. A concise list of what was not reviewed or could not be verified.
5. A final recommended decision: approve, approve with follow-ups, or do not approve.

Do not commit, push, deploy, or make source changes. At the end, report the document path and a concise summary of the highest-risk findings.
