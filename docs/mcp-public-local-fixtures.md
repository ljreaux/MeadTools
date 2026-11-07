# Local public-discovery brewing fixtures

These are explicitly synthetic brewing logs for local MCP/client testing, not
real fermentation evidence, a yeast comparison study, or process recommendations.
Names start with `MCP public demo`. They belong to a separate inactive fixture
account with no password or premium grant. Existing users, recipes, brews and
credentials are preserved. Nothing is written to Preview or production.

## Underlying recipes and realistic chronology

The fixture snapshots copy the existing public **Rapsberry Cheesecake** (D254),
**Blueberry Hibiscus Hydromel** (DV10), and **Mead Wiki Simple Trad Metric**
(US-05) recipes, retaining ingredients, amounts, units, yeast identity, nutrient
settings and targets. Source notes are not copied. The original recipes are not
edited. Rerunning the seed refreshes only fixture-owned snapshots from those
recipes; ordinary public reads never fetch a current source recipe to replace a
brew snapshot.

A new **MCP public demo — Raspberry 71B** recipe is calculated by the shared
recipe engine: 5 L primary must, 1 kg catalog raspberries, adjustable honey and
water, Lalvin 71B with its catalog Low nitrogen requirement, an 11% finished-ABV
plan, fermentation FG target 0.998 SG and honey backsweetening toward 1.012 SG.
Its saved loss setting allows 15% primary loss. Measured fruit/lees losses and
packaged volumes remain separate from those recipe estimates.

| Public fixture | Underlying recipe/yeast | Recorded history |
| --- | --- | --- |
| Two Raspberry Cheesecake batches (duplicate names, distinct IDs) | Existing Cheesecake / D254 | Must OG near the recipe's 1.0764 estimate; repeated dry FG 0.998/0.997; higher 1.022/1.021 readings after secondary honey, brown sugar and flavor additions; packaged after 62/75 days |
| Completed Blueberry Hibiscus | Existing Hydromel / DV10 | OG 1.052; repeated dry FG 0.997; finished 1.011 after the recipe's secondary honey; 3.75 L packaged after 47 days |
| Active Blueberry Hibiscus | Same recipe / DV10 | November 2 start; OG 1.050, general readings 1.030 and 1.014 on days 2/4; no FG or completion date |
| Incomplete Simple Trad log | Existing traditional / US-05 | OG 1.105; progress readings 1.040, 1.020, 1.018; racked to secondary; no tagged measured FG, stabilization, packaging or completion date |
| Two Raspberry 71B batches (duplicate names, distinct IDs) | New calculated recipe / 71B | OG close to the saved plan, repeated dry FG 0.999/0.998; finished 1.013/1.012 after secondary honey; packaged after 66/71 days |
| Legacy traditional | Legacy/unsupported recipe and snapshot | Original log/snapshot unavailable, repeated measured FG 1.006, 2.25 L packaged after 92 days; OG stays unknown |

Dated temperature readings, yeast pitch records, nutrient amounts from each saved
recipe's shared-engine calculation, racking volume, stabilization records,
secondary/flavor additions, and packaging rows make the brew pages inspectable.
Bottle counts agree with packaged liters. Losses from fruit/lees explain lower
measured yield than the source recipe's zero-loss estimate. Nonfermentable
flavoring and actual losses can also make measured finished gravity differ from
the simple recipe estimate. Repeated readings are recorded observations, not an
independent stability guarantee.

No automated sensor history is fabricated. A hidden, superseded FG entry and an
explicit recipe-target FG entry verify that analytics exclude those values.
Post-backsweetening readings are `GENERAL`, not dry `FG`. Completion dates are
packaging dates weeks after dry readings: **lifecycle is not fermentation time**.

Three additional controls must remain excluded from public search, detail and
summary: a private brew under the public 71B recipe; a public brew linked to a
private fixture recipe; and a public brew with no linked recipe. Their stored
status is PRIMARY, rather than pretending to be completed fermentations.

## Seed and verify

After the normal local catalog/recipe seed, run from the repository root:

```sh
ALLOW_MCP_PUBLIC_FIXTURES=true npm run db:seed:mcp-public --workspace @meadtools/web
```

This is an additive, repeatable fixture command, **not a database reset**. It
rejects production mode, non-loopback hosts and database names other than
`meadtools_dev`/`meadtools_test`. Only dedicated fixture-owned records are
upserted, with collision checks on fixed brew/entry IDs. It never removes
existing records. Rerunning restores fixture-controlled fields; extra manual
fixture entries are not deleted and may change expected statistics.

The command verifies all five public tools against actual PostgreSQL through the
same shared operations/database adapter used by MCP, without model-provider
calls. It asserts catalog/range combinations, duplicate-name pagination, legacy
coverage, private/missing-source exclusions and measured-versus-estimated values.
No schema change or migration is needed.

Expected summary for `filters: {"query":"MCP public demo"}`:

| Metric | Usable brews | Missing | Minimum | Mean | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Explicit measured OG, SG | 7 | 1 | 1.050 | 1.075142857 | 1.105 |
| Explicit measured dry FG, SG | 6 | 2 | 0.997 | 0.999166667 | 1.006 |
| Recorded lifecycle, days | 6 | 2 | 47 | 68.833333333 | 92 |

There are **8 matching public brews**, one unsupported snapshot, and two additional
public fixture recipes (one supported 71B plan and one legacy recipe). OG/FG
counts are independent, **not a count of paired readings**. Do not derive measured
ABV from these independent cohort means.

The first local PostgreSQL run and an idempotent rerun passed on November 6,
2026. Larry subsequently exercised all five operations in the dev-plugin chat and
verified the comparison labels and cohort results; see the
[manual client evidence](mcp-public-client-retest.md). Useful prompt: “Find the MCP public demo brews, open
both Raspberry Cheesecake batches, compare measured OG/dry FG with their saved
recipe estimates, then summarize the whole demo cohort with usable and missing
counts. Explain which finished sweetness readings are unavailable through these
public tools.” Public detail tools intentionally omit timeline
notes and finished GENERAL readings; inspect those records in the local brew
page rather than inventing unavailable tool fields or falling back to owner reads.
