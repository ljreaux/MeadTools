import { initialNutrientData } from "@meadtools/core/nutrients";
import {
  decodeDraftHandoff,
  draftHandoffSchema
} from "@meadtools/recipe-workflows/draft-handoff";

export function openDraftHandoff(
  href: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  newId: () => string
) {
  const url = new URL(href);
  let id = url.searchParams.get("draft");
  let handoff;
  if (url.hash) {
    handoff = decodeDraftHandoff(url.hash.slice(1));
    id = newId();
    storage.setItem(`meadtools:handoff:${id}`, JSON.stringify(handoff));
    storage.setItem(
      `meadtools:handoff:${id}:recipe`,
      JSON.stringify(handoff.recipeData)
    );
    url.hash = "";
    url.search = `?draft=${id}`;
  } else {
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Missing draft");
    handoff = draftHandoffSchema.parse(
      JSON.parse(storage.getItem(`meadtools:handoff:${id}`) ?? "null")
    );
    if (!storage.getItem(`meadtools:handoff:${id}:recipe`))
      throw new Error("Missing recipe");
  }
  // RecipeDataV2 permits missing nutrients, but the local builder hydration
  // gate expects a nutrient object. Normalize only that optional field so
  // opening/resuming a handoff never discards its recipe or existing edits.
  const recipeKey = `meadtools:handoff:${id}:recipe`;
  const storedRecipe = JSON.parse(storage.getItem(recipeKey)!);
  if (storedRecipe.nutrients === undefined) {
    storage.setItem(
      recipeKey,
      JSON.stringify({
        ...storedRecipe,
        nutrients: initialNutrientData()
      })
    );
  }
  return {
    handoff,
    key: `meadtools:handoff:${id}:recipe`,
    returnPath: url.pathname + url.search
  };
}
