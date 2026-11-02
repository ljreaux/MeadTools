# Specific chatbot progress verification

Two authorized hosted turns ran on the local server with GPT-5.6 Luna, medium
reasoning, minimal orchestration and the existing eight-tool limit. The batch
cap was $0.10 within the existing $2 evaluation ceiling. No replacement turns,
provider retries or new MCP turns were run. The local orchestration selection
was restored to guided afterward.

1. Find the saved Metric Traditional Test recipe and explain its calculations.
   Completed with named recipe steps and one search result. The details remained
   visible after the final answer. Four provider calls, 3 credits, $0.00132406.
2. Revise it to Lalvin EC-1118 as an unsaved draft while keeping other choices and
   explaining unsupported saved nutrient settings. Completed with the named yeast
   search (2 results), a broader catalog read (72 results), and the calculation
   target “4.219 L · Lalvin EC1118.” All five tool steps remained after completion.
   Six provider calls, 7 credits, $0.00346288.

The draft remained unsaved (`saved_recipe_id: null`). Independent recalculation
confirmed 4.219135 L, 14.368481% ABV, finished FG 1.011790 and 220 ppm target YAN.
The answer disclosed advanced saved nutrient settings that cannot carry over.
Nothing was saved back to the source recipe.

The settled ledger records 10 credits and $0.00478694 total provider cost.
Available account credits moved from 1,535 to 1,525. Cumulative tracked evaluation
spend is $0.36421493. Temporary reservation balances were not treated as charges.

Both live turns succeeded without tool errors, so failure-specific explanations
were verified deterministically rather than claimed as observed provider behavior.
Tests cover safe names/counts, missing fields, volume conflicts, exact HTTP status
extraction, redaction, early invalid-input completion and streaming detail delivery.
Verification: 259 web tests, 18 chat-domain tests and 44 API-contract tests pass;
web and chat-domain typechecks pass. Contract and OpenAPI generation completed
without generated changes. Targeted lint has no errors and nine existing hook
warnings. No PR or deployment was created.

Local evidence is under `.codex/454-comparison/hosted-luna-specific-*`, including
the sanitized profile, ledger/transcript evidence, independent draft calculations,
UI text and progress screenshot. Progress history is transient: only the latest
request remains in the open chat, and reloading or navigating clears it.
