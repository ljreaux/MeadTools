# Record identity and presentation provider retest

Two explicitly approved hosted turns ran on October 20, 2026 using GPT-5.6 Luna /
medium, the shared identity/presentation changes, and the accepted 100,000-token /
twelve-tool / fourteen-provider-call profile. A fresh conversation repeated the
Active/Unlinked comparison, followed by the same nonexistent-brew-ID history probe.
No attachments, mutations or replacement turns were used.

Both targeted checks passed in this batch:

- The comparison retrieved both named brew details successfully, both six-entry
  manual histories and both sensor summaries. All ten displayed tool steps
  completed, including wiki search and two page fetches. There were no displayed
  invalid-input or not-found steps. It cited fetched hydrometer guidance.
- Both 1.100 → 1.055 manual changes were reported as decreases during their dated
  intervals. The answer did not infer current activity or confirmed completion.
  Active's 289-sample October 11–14 coverage was disclosed. It explicitly described
  matching aggregate range/endpoints and said samplewise equality was not assessed.
  Unlinked's successful zero-sample result was distinguished from a failed lookup.
- The missing-record probe performed a failed read, then said in plain language
  that the history could not be retrieved and this did not prove no readings
  existed. It left availability unknown. Neither final answer exposed internal
  tool names or record IDs. No brew was changed.

| Turn | Calls | Total tokens | Latency | Provider cost | Credits |
| --- | ---: | ---: | ---: | ---: | ---: |
| Comparison | 12 | 109,464 | 24.1 s | $0.00620594 | 11 |
| Missing-record probe | 2 | 12,514 | 3.1 s | $0.00055054 | 1 |

Usage includes the existing title path. The token guard checks between responses;
a completed final answer may cross 100,000 cumulative tokens, as happened here.
The accepted limits were not raised again. This is one successful targeted batch,
not proof that all future comparisons will finish or that the earlier failed
arguments have been diagnosed. Model behavior varies; no causal attribution to
any single identity or wording change is established by this run.

Batch cost was $0.00675648, using twelve credits (1,376 → 1,364). Cumulative tracked
provider spend is $0.44208839 within the $2 ceiling. Both authorized turns were
used; no extra/replacement provider turns were initiated. Saved brew records
retain their original pre-evaluation digest. No drafts, migrations, deployments,
commits or PRs were created. Code was unchanged during this retest; preceding
verification remains 197 web + 56 agent + 44 API-contract tests passing, with
web/agent typechecks and targeted lint passing.

Local evidence: `.codex/454-comparison/hosted-luna-identity-*` (effective profile,
retained answers/usage, UI steps and screenshots). No further paid runs are active.
