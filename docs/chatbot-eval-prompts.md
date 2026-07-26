# Recipe chatbot evaluator prompts

Use a fresh evaluator session for each scenario unless the scenario explicitly
contains multiple messages. Export any notable session into the ignored
`docs/chatbot-evals/exports/` folder for review.

## 1. One-message complete blueberry draft

> Create a 5 gallon blueberry mead recipe. I want it to finish dry and backsweeten, with 15 lb of blueberry split evenly between primary and secondary. Target about 16% ABV. Use Lalvin 71B, Fermaid K only with Go-Ferm, and three nutrient additions. Use potassium metabisulfite; I am not taking a pH reading.

Expected: a completed unsaved draft; calculated values come from MeadTools; the
user-supplied blueberry amount and assumed pH are clearly labeled; no catalog IDs, Brix,
tool names, or internal labels appear.

## 2. Progressive strawberry intake

Send these one at a time:

1. `Create me a strawberry mead recipe.`
2. `Make it 5 gallons, finish dry and backsweeten, and put strawberry in both primary and secondary. Use Fermaid K only with Go-Ferm.`
3. `Target 14% ABV. Use Lalvin 71B, 15 lb of strawberry split evenly, three nutrient additions, potassium metabisulfite, and assume pH 3.5.`

Expected: each reply acknowledges already-captured details, avoids repeated
questions, and reaches a draft after the final message.

## 3. Ingredient lookup and quantity clarification

> Build a 3 gallon raspberry-vanilla mead at 12% ABV. Use fruit in secondary, EC-1118, Fermaid K with Go-Ferm, and three nutrient additions. Let it ferment dry after the secondary fruit, then stabilize it; I do not want to backsweeten.

Follow-up, if needed:

> Use 6 lb of raspberries. I want one whole vanilla bean in secondary. I am not taking a pH reading; use the default estimate.

Expected: the bot looks up raspberry and yeast data instead of asking for Brix
or nitrogen requirements. Vanilla belongs in Additives rather than Ingredients.
It may ask only for a genuinely missing quantity, and it should recognize that
secondary fruit ferments before stabilization.

## 4. Cyser with an explicit honey amount

> Draft a 1 gallon cyser with 1 gallon of fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize.

Expected: the bot explains why the constraints conflict: the cider already
fills the requested finished volume, leaving no room to solve the honey and
water around the target gravity. It should offer a specific correction path
(reduce the fixed liquid or choose a larger batch) rather than inventing cider
data or failing silently.

## 5. Traditional mead, minimal request

> I want a 2 gallon traditional mead that finishes medium-sweet. Pick a sensible yeast and nutrient plan for me, but explain each assumption before finalizing it.

Expected: the bot asks a small number of high-impact questions rather than
dumping a checklist. In particular, it must establish the sweetness strategy:
a reliably medium-sweet mead at a modest ABV generally needs stabilization and
backsweetening rather than an assumed naturally sweet finish. It should not
claim a saved recipe or provide uncited process instructions.

## 6. Correction and refinement after a draft

First send:

> Create a 5 gallon cranberry mead at 14% ABV with Lalvin 71B, Fermaid K and Go-Ferm, three nutrient additions, and 8 lb of cranberry in primary. Finish dry with no backsweetening.

After a draft is available, send:

> Change the cranberry to 5 lb in primary plus 5 lb in secondary, then make it suitable for backsweetening with potassium metabisulfite. I will not take a pH reading.

Expected: the second turn retains the original batch/yeast/nutrient choices,
does not re-ask them, and clearly labels the pH assumption.

## 7. Process: stabilize and backsweeten

> My traditional mead has fermented dry. I want to stabilize it and backsweeten
> it safely. What process should I follow, and what should I measure before I
> start?

Expected: the bot retrieves the relevant MeadTools wiki process guidance and
cites its canonical wiki page. It gives process-oriented help rather than
creating a recipe draft or pretending there is one universal stabilizer amount.

## 8. Process: yeast rehydration

> How should I rehydrate Lalvin 71B with standard Go-Ferm before pitching?

Expected: a concise wiki-grounded procedure with a canonical citation. The bot
should not invent a recipe, catalog ID, or an unrelated nutrient schedule.

## 9. Process: troubleshooting sulfur aroma

> My fermenting mead smells like rotten eggs. What are the likely causes and
> what should I do first?

Expected: the bot uses MeadTools wiki troubleshooting material, cites it, and
clearly distinguishes immediate low-risk checks from decisions that depend on
the batch details.

## 10. Scope boundary: unrelated questions

Run each in a fresh session:

> What is the capital of France?

> Can you write my resignation letter?

> What is Bitcoin trading at right now?

Expected: the bot politely says it is limited to mead recipe and MeadTools wiki
questions. It must not browse, use MeadTools recipe tools, or answer the
unrelated request.

## 11. Calculator routing

Run each in a fresh session:

> Can you calculate the exact sulfite amount for me?

> How much priming sugar do I need for carbonation?

> How do I correct a refractometer reading after fermentation?

Expected: each response links directly to the matching internal MeadTools
calculator, rather than asking the model to reproduce a formula, give a dose,
or start a recipe draft. Exact-calculation requests should not require a model
call. Process-only questions, such as scenario 7, should still use the wiki
when no exact calculator result is requested.
