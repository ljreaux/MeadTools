# Public discovery: local ChatGPT retest, November 6, 2026

Larry tested the installed **MeadTools Local Dev** plugin in regular ChatGPT
through the private OpenAI tunnel. This is user-operated client evidence supplied
in chat, not an automated provider batch; the report did not identify a model.
The data is the synthetic [local brewing fixture set](mcp-public-local-fixtures.md),
not real fermentation observations or representative yeast-performance data.

## Functional results

The initial manual test exercised recipe discovery/details and empty brew
search/summary responses. After seeding the additive local fixtures, the retest
exercised all five public tools, including `get_public_brew`.

The supplied report matches the fixture expectations:

- Two public recipes and eight public brews match `MCP public demo`.
- Six brews are completed; two have incomplete/active logs.
- Seven snapshots are supported; one is explicitly legacy/unsupported.
- The full cohort has seven usable OG records, six usable FG records and six
  usable start/end date intervals. Missing counts are respectively one, two, two.
- OG mean 1.075142857 SG, FG mean 0.999166667 SG and recorded lifecycle mean
  68.833333333 days agree with database-backed verification.
- The two 71B brews have mean OG 1.084 SG, mean FG 0.9985 SG and mean lifecycle
  68.5 days. Distinct duplicate-name records were preserved.
- Reported summaries came from the dedicated complete-cohort operation, with
  selection bias and incomplete-data caveats; no private owner reads were used.

This client report does not independently prove all private/deleted visibility
boundaries. Those are covered by deterministic fixtures and the local PostgreSQL
seed/verification command.

## Interpretation issue and deterministic follow-up

The report's recipe-versus-brew table put brew #007's **0.998 SG measured
fermentation FG** opposite its recipe's **1.0144 SG estimated finished gravity**
on a row labeled “Finished gravity.” The prose cautioned about backsweetening,
but the table still conflated two stages. The correct comparison is:

| Quantity | Saved recipe | Returned brew measurement |
| --- | --- | --- |
| Original gravity | Estimated 1.0842 SG | Recorded OG 1.083 SG |
| Fermentation FG | Target 0.998 SG | Explicitly tagged FG 0.998 SG |
| Finished/backsweetened gravity | Estimated 1.0144 SG | Not returned by public tools |
| ABV | Estimated 10.94% | Not returned by public tools |

The fixture also has a later GENERAL sweetness reading in its local brew log.
Public details intentionally expose only the selected OG/FG-role readings; they
do not return that GENERAL reading. Its omission cannot be filled by relabeling
the dry FG, calculating measured ABV from cohort means or using private tools.
Recorded lifecycle is a derived start/end interval, not a direct measurement of
fermentation duration. The report's independent counts are not OG/FG pair counts.

Before changing the guidance, a deterministic regression reproduced the absent
reading-basis metadata on a sweetened recipe with a low measured fermentation FG.
The fix adds `readingBasis` to strict public results and explicitly describes the
FG role in the output schema. Shared MCP and hosted guidance instructs clients
to align `measuredFg` with `fermentationTargetFgSg`, never label it as finished
gravity, and report measured finished gravity/ABV as unavailable through these
tools. Stored numbers, filters, visibility predicates and calculations do not
change. This is guidance, not enforcement of a model's wording.

## Manual retest after the clarification

Larry supplied a second regular-ChatGPT report on November 6, using fresh public
calls and a prompt that explicitly requested separate fermentation/finished
labels. Both 71B brew details and all five public operations succeeded. The
comparison correctly aligned measured fermentation FG 0.999/0.998 SG with the
0.998 target, while leaving measured finished gravity and measured ABV as
“not returned” beside the separate finished recipe estimates.

The supplied OG differences (+0.00075/-0.00125 SG), FG differences
(+0.001/0 SG), stored-volume differences (-0.150/-0.525 L), dates, 66/71-day
lifecycles and full-cohort counts/ranges/means agree with the fixtures within
reported rounding. It correctly qualified stored current volume as distinct
from confirmed packaged yield, OG/FG counts as independent, and FG timestamps as
reading dates rather than proof of fermentation completion. Synthetic-data and
selection-bias limitations were retained, with no private account reads reported.

This is a successful manual retest of the requested comparison. Because its
prompt explicitly stated the desired distinctions, it does not establish that
all unconstrained prompts or other clients will label these values correctly.
The regression and broader deterministic suites remain the repeatable evidence
for the shared contract. No automated real-model calls were made. At this point,
184 deterministic tests, both recipe-agent/web typechecks and package-boundary
checks pass. Work remains uncommitted for review.
