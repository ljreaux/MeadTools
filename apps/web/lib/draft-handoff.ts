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
  return {
    handoff,
    key: `meadtools:handoff:${id}:recipe`,
    returnPath: url.pathname + url.search
  };
}
