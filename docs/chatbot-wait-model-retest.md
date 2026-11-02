# Wait-experience provider retest — October 19, 2026

The user approved a few more chatbot tests. This was bounded before execution
to four hosted Luna/medium turns, minimal orchestration, expected cost below
$0.10 and a $0.25 batch cap within the existing $2 cumulative ceiling. It used
MeadTools User's normal browser session and chat credits. Eight tools and ten
provider calls per turn remained; lower reasoning was not tested.

All four turns completed with served model `gpt-5.6-luna`. Product code stayed
fixed during the batch. No failed provider turns were replaced. Browser waits
for a short-lived preview did not resubmit any test.

| Test | Credits | Service latency | Words | Result |
| --- | --- | --- | --- | --- |
| Metric Traditional Test walkthrough | 4 | 8.660 s | 226 | Correct gravity distinction, volumes, ABV, nutrients and stabilizer doses. No unsolicited process section or wiki referrals. |
| EC1118 unsaved revision | 6 | 14.825 s | 192 | Retains water, both honey amounts/stages, additives and nutrient choices; discloses advanced nutrient limitations. Real unsaved payload recalculates to 4.219135 L and 14.368481% ABV. |
| Active Test Brew review | 4 | 10.967 s | 231 | Reads actual OG, subsequent SG and latest 1.000 reading, dates pH/temperature, separates missing records from known facts. |
| Gravity follow-up plus quadratic equations | 4 | 20.054 s | 144 | Uses brew context and a hydrometer wiki source; explicitly refuses algebra. A recoverable tool error produced an interim warning before completion. |

The browser showed `recipe-answer-preview` text while the request was still
running, including a partial walkthrough with its progress marker and Stop
streaming control. This verifies live preview delivery independently of the
final persisted text. The screenshot saved slightly later captured the finished
answer, so it must not be used as a first-token timing measurement. Two later
short waits missed the transient preview; no exact time-to-first-text or
continuous browser recording was collected. The live observation is in the
browser tool record; final screenshots and visible transcripts are saved locally.

## Credits compared with earlier versions

For the same three matched prompts (walkthrough, revision, brew review):

| Version | Total credits | Average per request |
| --- | --- | --- |
| Pre-Luna 5.4 mini | 58 | 19.33 |
| Luna minimal before wait changes | 23 | 7.67 |
| Luna minimal after wait changes | 14 | 4.67 |

This paired three-prompt sample used about 76% fewer credits than mini and 39%
fewer than the previous minimal run. It is too small to promise that reduction
for general usage. The original full six-prompt comparison averaged 15.5 credits
for mini, 5.0 for the first guided Luna batch, and 7.67 for the first minimal Luna
batch. Different subsets should not be presented as one controlled comparison.

Matched service times improved from 20.504 → 8.660 seconds for the walkthrough,
28.631 → 14.825 seconds for the revision, and 15.670 → 10.967 seconds for the brew
review. These sequential samples also differ in cache state and model choices.
No provider traces establish which individual policy/cache change caused the
improvement. Streaming improves readability during generation; it does not by
itself reduce model execution time. The final mixed request took about 20 seconds
and remains an example where feedback matters.

## Accounting and follow-up

The four-turn batch consumed **18 credits** (1,570 → 1,552), averaging **4.5
credits per request**. Provider cost was **$0.00960824**, reconciled independently
using the shared integer credit-accounting library against the settled ledger.
There were 22 provider requests including normal title generation. Cumulative
comparison cost is **$0.35942799 of $2**. No extra tests were run.

All answers were under 250 words. The revision payload remains unsaved and no
brew changes were made. Both requested behavior preservation and mixed-request
scope resistance held in this sample. The recoverable-tool warning deserves a
future deterministic regression and UX review; the answer still completed with
its source and scope boundary intact. Specific progress labels are implemented
and locally covered, but this browser pass did not capture every short-lived
individual tool label.

Local orchestration was restored to guided after the test, leaving the default
unchanged. No PR, commit, push, deployment or database migration was performed.
Ignored evidence uses `.codex/454-comparison/hosted-luna-latency-*`, including
sanitized profile, accounting/messages/drafts, summary, transcripts, independent
recalculation, recipe/final visible snapshots and final screenshots.

A later offline UI correction addresses the interim warning recorded above:
progress no longer treats any historical tool error as a failed request. Active
recovery uses a neutral status, and later successful activity clears the old
warning. This was covered by deterministic regressions, without another provider
batch; the observations and costs above remain unchanged.
