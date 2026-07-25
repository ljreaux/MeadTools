# Recipe chatbot evaluator prompts

Use a fresh evaluator session for each scenario unless the scenario explicitly
contains multiple messages. Export any notable session into the ignored
`docs/chatbot-evals/exports/` folder for review.

## 1. One-message complete blackberry draft

> Create a 5 gallon blackberry mead recipe. I want it to finish dry and backsweeten, with heavy blackberry split evenly between primary and secondary. Target about 16% ABV. Use Lalvin 71B, Fermaid K only with Go-Ferm, and three nutrient additions. Use potassium metabisulfite; I am not taking a pH reading.

Expected: a completed unsaved draft; calculated values come from MeadTools; the
assumed blackberry amount and pH are clearly labeled; no catalog IDs, Brix,
tool names, or internal labels appear.

## 2. Progressive blackberry intake

Send these one at a time:

1. `Create me a blackberry mead recipe.`
2. `Make it 5 gallons, finish dry and backsweeten, and put blackberry in both primary and secondary. Use Fermaid K only with Go-Ferm.`
3. `Target 14% ABV. Use Lalvin 71B, heavy fruit split evenly, three nutrient additions, potassium metabisulfite, and assume pH 3.5.`

Expected: each reply acknowledges already-captured details, avoids repeated
questions, and reaches a draft after the final message.

## 3. Ingredient lookup and quantity clarification

> Build a 3 gallon raspberry-vanilla mead at 12% ABV. Use fruit in secondary, EC-1118, Fermaid K with Go-Ferm, and three nutrient additions. Let it ferment dry after the secondary fruit, then stabilize it; I do not want to backsweeten.

Follow-up, if needed:

> Use 6 lb of raspberries. I want one whole vanilla bean in secondary.

Expected: the bot looks up raspberry and yeast data instead of asking for Brix
or nitrogen requirements. Vanilla belongs in Additives rather than Ingredients.
It may ask only for a genuinely missing quantity, and it should recognize that
secondary fruit ferments before stabilization.

## 4. Cyser with an explicit honey amount

> Draft a 1 gallon cyser with 1 gallon of fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize.

Expected: the bot explains why the constraints conflict: the cider already
fills the requested finished volume, and the fixed honey adds both volume and
enough fermentable sugar to exceed the 10% ABV target. It should offer a
specific correction path rather than inventing cider data or failing silently.

## 5. Traditional mead, minimal request

> I want a 2 gallon traditional mead that finishes medium-sweet. Pick a sensible yeast and nutrient plan for me, but explain each assumption before finalizing it.

Expected: the bot asks a small number of high-impact questions rather than
dumping a checklist. In particular, it must establish the sweetness strategy:
a reliably medium-sweet mead at a modest ABV generally needs stabilization and
backsweetening rather than an assumed naturally sweet finish. It should not
claim a saved recipe or provide uncited process instructions.

## 6. Correction and refinement after a draft

First send:

> Create a 5 gallon blackberry mead at 14% ABV with Lalvin 71B, Fermaid K and Go-Ferm, three nutrient additions, and 8 lb of blackberry in primary. Finish dry with no backsweetening.

After a draft is available, send:

> Change the blackberry to 5 lb in primary plus 5 lb in secondary, then make it suitable for backsweetening with potassium metabisulfite. I will not take a pH reading.

Expected: the second turn retains the original batch/yeast/nutrient choices,
does not re-ask them, and clearly labels the pH assumption.
