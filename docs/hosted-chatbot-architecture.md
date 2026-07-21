# Hosted recipe chatbot architecture

## Repository findings

- `packages/schemas` owns the authoritative v2 recipe and nutrient Zod schemas. `packages/core` owns recipe, gravity, ABV, nutrient, stabilizer, and conversion calculations.
- `packages/api-contract` and `packages/api-client` already expose the `/api/recipes/derived` contract. The web route validates recipe data and calls `calculateRecipeDerivedApiResponse`.
- The browser recipe builder keeps editable draft state in `RecipeProvider` and calculates through `@meadtools/core`; its target-OG action uses `calculateHoneyAndWaterL`.
- The web app supports NextAuth sessions plus the existing custom bearer-token path in `verifyUser`. Recipe ownership and saving already use the `users` and recipe infrastructure.
- No paid-plan, billing, entitlement, conversation, or model-provider implementation was found. No AI SDK is a direct workspace dependency and no streaming chat route exists yet.

## Selected boundaries

```text
packages/recipe-workflows/              deterministic, transport-free operations
  src/contracts.ts                      versioned needs_input | recipe | error results
  src/create-traditional.ts             first create operation
  eval/representative-conversations.ts  product/evaluation cases

packages/recipe-agent/                  future provider-neutral tool orchestration
apps/web/lib/ai/                        future model provider and server composition
apps/web/app/api/chat/recipe/route.ts    future auth, entitlement, streaming boundary
apps/web/components/chat/                future structured questions/cards/actions
apps/web/prisma/                         future conversations, messages, usage/entitlements

meadtools-mcp (separate repository)      future thin adapter/development harness only
```

The deterministic package has no HTTP, authentication, persistence, model, or UI dependency. It receives already interpreted structured input, validates any generated payload against `recipeDataV2Schema`, invokes `@meadtools/core`, and validates the calculated response against the existing API contract. This lets the hosted agent, web API, tests, and an optional MCP adapter share one source of workflow behavior.

## MCP migration decisions

| MCP area | Decision | Reason |
| --- | --- | --- |
| `src/workflows.ts` intake questions and dry-vs-backsweetening rules | Rewrite incrementally in deterministic operations | The intent is reusable, but the current function mixes inference, catalog HTTP, payload construction, calculation, and reporting. |
| `src/volume.ts` and recipe math helpers | Discard duplicates | Use `@meadtools/core` constants and calculations. |
| `src/schemas.ts` recipe payload definitions | Discard | Permissive records allowed schema drift; import `@meadtools/schemas` instead. |
| `src/meadtools-client.ts` | Keep only in a future thin MCP adapter | In-process hosted workflows should not call MeadTools back through public HTTP. |
| `src/recipe-report.ts` | Migrate presentation concepts later | Structured cards belong in chatbot response/view contracts, not the calculation boundary. |
| `src/prompts.ts` | Rewrite as hosted agent policy and evaluation criteria | Tool-use principles remain useful, but MCP prompt registration is not the product architecture. |
| mocked workflow tests | Replace | Contract tests must parse real shared schemas and run the real calculation engine. |

## Delivery sequence after this foundation

1. Add deterministic `refine` and `explain` operations using the same result union and active recipe draft input.
2. Add a provider-neutral hosted agent package whose tools can only call deterministic workflow operations; add model-level evaluations for tool choice, follow-up behavior, and grounded explanations.
3. Select a hosted model/provider, add server-only configuration, and implement an authenticated streaming route using `verifyUser`/NextAuth conventions.
4. Define and implement paid entitlements. Billing does not exist today, so access checks need a new explicit data model and provider integration rather than relying on `role`.
5. Add conversation/message persistence tied to existing users, with idempotency, usage limits, retention, and observability.
6. Add chat UI renderers for questions, recipe cards, warnings, and apply/save actions; connect accepted drafts to `RecipeProvider` before enabling persistence.
7. Reduce the separate MCP server to an adapter that imports or calls the shared operations, then add parity tests between MCP and hosted tools.
