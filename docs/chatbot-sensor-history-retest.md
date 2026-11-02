# Sensor-history provider retest

Two hosted turns were authorized after the earlier request to hold off was
superseded. Model: GPT-5.6 Luna, medium reasoning, the sole model-led path, eight
tools and ten provider calls per turn. Expected cost below $0.10; batch cap $0.15
inside the existing $2 evaluation ceiling ($0.39007453 used before this batch).
No replacement turns, tool-budget changes or product changes were made mid-batch.

## Prompts

1. “Review my Active Test Brew using its manual timeline and automatic sensor
   history. Are the recorded readings enough to confirm fermentation has finished
   and it is ready to rack? Use dated evidence, distinguish measured and
   device-calculated readings, and state any limits in the history you actually
   retrieved. Don't change the brew.”
2. “Compare the recorded evidence for Active Test Brew with my Unlinked Test Brew.
   Which has stronger evidence for fermentation being finished, and what specific
   measurement would you need next for each? Use their manual records and automatic
   sensor histories, distinguish measured and device-calculated readings, and
   disclose the coverage you actually retrieved. Don't change either brew.”

## Results: both tasks failed at the cumulative token limit

| Turn | Observed tool results | Provider calls | Total tokens | Latency | Credits |
| --- | --- | --- | --- | --- | --- |
| Active assessment | Record lookup, one invalid-input recovery, manual timeline, four 20-sample sensor pages | 9 | 65,538 | 16.684 s | 9 |
| Two-brew comparison | Record lookup, one invalid-input recovery, manual timelines, 20 sensor samples for Active and empty sensor history for Unlinked, wiki search | 8 | 65,241 | 11.028 s | 6 |

Both ended with the provider-token-limit fallback instead of a brewing assessment.
The service checks its cumulative 60,000-token bound between completions, so the
last dispatched completion can cross that threshold. This is the existing guard's
behavior, not an automatic retry or a new limit change. These are failed capability
tests even though their generation records settled as complete with the fallback.
Neither turn established source-grounded readiness, stability, or a final comparison.

The first used 64,665 input tokens (50,258 cached) and 873 output tokens. The second
used 64,741 input tokens (57,741 cached) and 500 output tokens. Increasing transcript
and tool-result context is therefore the immediate constraint. The UI proves the
page counts but does not capture full tool arguments, so this report does not claim
the exact date windows or that all returned pages were unique. The failed first
answer was the only persisted assistant context supplied to the second turn; the
second did not inherit a successful assessment from it.

Read-only ground truth still contains 673 device samples for Active Test Brew,
from October 7 at 17:12 UTC through October 14 at 17:12 UTC. Its latest sample is
1.000 SG. Unlinked Test Brew has no automatic sensor history. A before/after
comparison confirms the selected brew records, manual entries and device histories
were unchanged. No drafts or brew actions were created.

Settled cost was $0.00808898 and 15 credits (account balance 1,461 → 1,446).
Cumulative tracked evaluation cost is $0.39816351. No further provider turns ran.
Evidence is retained under `.codex/454-comparison/hosted-luna-sensor-*`, including
sanitized configuration, transcripts/ledger, UI progress captures and read-only
ground truth. The sensor index migration remains unapplied.

## Next change to evaluate

Keep paginated raw samples for inspection, but add a compact shared sensor-history
summary operation for date windows: sample count, actual covered interval, first/
last measured and derived values, min/max/range, and sampling gaps. The result
should distinguish missing data, sparse coverage and device-derived values, and
must not assert fermentation completion. Apply the same ownership and date bounds
to MCP and hosted clients. This gives the model evidence spanning days without
serializing every sample or adding host-only forced sequencing.

Also review repeated guidance/metadata and the failed account-input attempts for
avoidable context cost. The observations suggest these as contributing factors;
this batch did not measure token attribution by individual tool-result field.
Add deterministic regression cases for the observed budget exhaustion and summary
coverage before treating a fix as complete, then request approval for a separate
provider retest. No fixes or new paid tests are included in this report.
