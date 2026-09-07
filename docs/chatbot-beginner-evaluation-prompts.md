# Beginner chatbot evaluation prompts

This is a conversational regression suite written from the perspective of a
brand-new mead maker. Use a fresh chat for each numbered scenario unless the
scenario defines follow-up messages or requires selected account context.

These prompts intentionally include incomplete and natural wording. Do not
rewrite the agent to require more technical phrasing; when information is
genuinely needed, the expected behavior is one focused clarification or a
clearly labelled MeadTools-backed default.

Before any real-provider batch, obtain approval that names the provider/model,
expected number of turns, and expected spend. Save notable results in the
ignored `docs/chatbot-evals/exports/` directory.

## First-time brewing and core concepts

1. `I’m completely new to mead. What equipment do I actually need for my first 1-gallon batch?`
2. `Can you explain the basic mead-making process from start to finish like I’ve never fermented anything before?`
3. `Help me make my first traditional mead recipe using only honey, water, yeast, and nutrients.`
4. `What’s the easiest beginner-friendly mead recipe I can make with grocery store ingredients?`
5. `I want a sweet mead, but I don’t understand gravity readings yet. Can you design a simple recipe for me?`
6. `What kind of honey should I buy for my first batch?`
7. `What yeast should a beginner use for a clean, forgiving first mead?`
8. `Can you explain yeast nutrients and when I should add them?`
9. `What does staggered nutrient addition mean, and do I need to do it?`
10. `How do I sanitize everything properly before making mead?`

Expected: concise, beginner-oriented answers. Process claims should use Modern
Meadmaking Wiki evidence and citations; exact calculations should link the
matching MeadTools calculator.

## Beginner recipe directions

11. `Can you create a 1-gallon beginner recipe for a semi-sweet orange blossom traditional mead?`
12. `Build me a beginner blueberry mead recipe that isn’t too complicated.`
13. `I want to make a cyser with apple juice and honey. Can you make me a simple beginner recipe?`
14. `Can you design a 1-gallon strawberry mead that tastes fruity but not syrupy?`
15. `Make me a beginner bochet recipe and explain what I need to watch out for.`
16. `Can you help me make a low-ABV session mead around 6%?`
17. `I want a dry mead instead of sweet. What would you recommend for my first batch?`
18. `Can you make a beginner recipe using wildflower honey and blackberries?`
19. `Help me make a holiday-style spiced mead with cinnamon and orange.`
20. `Create a first-time recipe for a simple lemon ginger mead.`

If the agent proposes a direction, follow with a direct draft request:

> `Please use sensible beginner defaults and build the 1-gallon draft now.`

For prompts 19 and 20, accept a short additive recommendation or answer the
one clarification if no MeadTools-backed amount is available. The agent must
retain an accepted additive amount and unit; it must not ask for it again.

Expected: use the agreed beginner defaults where adequate (medium strength,
medium sweet unless the user says dry, TOSNA with 3–4 additions, Go-Ferm, and
assumed pH 3.5 when stabilization is needed). A direct build request must
build rather than restart intake. Dry explicitly means no backsweetening.

## Saved recipe and brew context

The current chat attaches one recipe or brew at a time. The broad “all my
saved recipes” wording remains a valid future-feature acceptance test, but the
current UI evaluation must attach an explicit record before expecting
record-specific reasoning.

For each current-capability scenario below, select one saved recipe in the
**Attach a recipe or brew** control first. Use `Key Lime Pie` when a fixture is
needed.

21. `Is this attached recipe easy for a beginner to brew? What are the hardest parts?`
22. `Based on this attached recipe, what style of mead do I seem to like?`
23. `Suggest a new beginner recipe inspired by this attached recipe.`
24. `Would this attached recipe be reasonably easy to scale down to 1 gallon, and what would change?`
25. `Is this attached recipe's process simple for a beginner? Explain the main complexity points.`
26. `Suggest one improvement I could try next time with this attached recipe.`
27. `How could I adapt this attached recipe to be lower alcohol while keeping its character?`
28. `How could I make this attached recipe sweeter and more beginner-friendly?`
29. `Based on this attached recipe, suggest a different beginner-friendly fruit-mead direction I could try next.`
30. `I have wildflower honey, frozen blackberries, cinnamon, and a packet of Lalvin 71B. What could I make from those?`

Future library-wide acceptance prompts, to run once bounded recipe-library
search is implemented:

- `Which of my saved recipes would be easiest for a beginner to brew?`
- `Based on my saved recipes, what style of mead do I seem to like?`
- `Can you compare my saved recipes and tell me which one has the simplest process?`
- `Can you find a saved recipe that uses ingredients I might already have at home?`

Expected now: the bot should politely explain the one-record attachment limit
and offer the attachment control. It must not return the generic out-of-scope
answer. Expected later: it should use a bounded account-recipe search tool,
not receive a user's complete recipe library in model context.

## Process and troubleshooting

31. `My recipe says to rack to secondary. What does that mean?`
32. `How do I know when primary fermentation is finished?`
33. `What is an airlock, and what should I expect to see in it?`
34. `My mead stopped bubbling. Is something wrong?`
35. `How often should I take gravity readings?`
36. `What does original gravity mean?`
37. `What does final gravity mean?`
38. `How do I calculate ABV from gravity readings?`
39. `Why does my mead smell like sulfur, and what should I do?`
40. `What temperature should I ferment my first mead at?`
41. `Can you help me troubleshoot a mead that tastes harsh after fermentation?`
42. `When should I add fruit: primary or secondary?`
43. `How do I backsweeten safely without restarting fermentation?`
44. `Do I need to stabilize my mead before adding more honey?`
45. `What are potassium sorbate and potassium metabisulfite used for?`
46. `How long should I age my first mead before drinking it?`
47. `Can you explain clearing, fining, and cold crashing in beginner terms?`
48. `What are the most common mistakes new mead makers make?`

Expected: prompts 42 and 47 are plainly in scope despite not saying “mead.”
The agent should use Modern Meadmaking Wiki process guidance, clean Markdown,
and canonical citations. Prompt 38 should link the ABV calculator instead of
performing a hand calculation.

## Incomplete-information and checklist handling

49. Start with:

    `Can you review this recipe and tell me if anything looks risky for a beginner?`

    Expected first response: request the recipe text or selected recipe context,
    not an out-of-scope refusal.

    Follow with:

    `Here is the recipe: 1 gallon, 4 lb honey, EC-1118, no nutrients, and I plan to bottle it sweet at 1.020 without stabilizing. What looks risky for a beginner?`

    Expected: identify the lack of nutrition and unstabilized sweet bottling as
    risks, using cited process guidance.

50. `Give me a simple brew-day checklist for making my first mead.`

Expected: a practical, concise checklist with sanitation, mixing/measurement,
yeast, and nutrient steps. It should not invent exact recipe quantities.

## Cross-scenario regression assertions

- “Build/make the draft” is terminal if all calculation-critical choices have
  defaults or have already been supplied.
- User corrections and removals persist. `Scrap this recipe draft` clears the
  active working plan rather than returning the old draft.
- Fruit/honey/water remain recipe ingredients; cocoa nibs, vanilla, cinnamon,
  ginger, orange peel, and similar items are Additives.
- User-supplied additive units/amounts survive into a generated draft when they
  match the recipe-builder's supported units.
- No response exposes catalog IDs, tool names, Brix/database implementation
  details, or unsupported exact calculations.
