import type { ChatToolProgressDetail } from "./index";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function label(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:sk|rk|sess)-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/\s+/g, " ").trim().slice(0, 120) || undefined;
}

export function describeChatToolProgress(name: string, input: unknown, execution?: unknown): ChatToolProgressDetail {
  const args = object(input), outer = object(execution), result = object(outer.result);
  const details: ChatToolProgressDetail = {};
  if (["list_recipes", "list_brews", "search_yeasts", "search_wiki"].includes(name)) details.subject = label(args.query);
  if (name === "get_recipe") details.subject = label(object(result.recipe).untrustedName);
  if (name === "get_brew") details.subject = label(object(result.brew).untrustedName);
  if (name === "fetch_wiki_page") {
    details.subject = label(result.title);
    if (!details.subject && typeof args.url === "string") {
      try {
        const url = new URL(args.url);
        if (url.hostname === "wiki.meadtools.com" && !url.username && !url.password) {
          details.subject = label(decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "").replace(/_/g, " "));
        }
      } catch { /* Invalid or unrelated URLs do not become progress labels. */ }
    }
  }
  if (["build_recipe_draft", "record_recipe_plan"].includes(name)) {
    const plan = name === "record_recipe_plan" ? object(args.plan) : args;
    const volume = object(plan.batchVolume), nutrients = object(plan.nutrients);
    const parts: string[] = [];
    if (typeof volume.value === "number" && Number.isFinite(volume.value) && ["gal", "L"].includes(String(volume.unit))) parts.push(`${volume.value} ${volume.unit}`);
    if (typeof plan.targetAbv === "number" && Number.isFinite(plan.targetAbv)) parts.push(`${plan.targetAbv}% ABV`);
    const yeast = label([nutrients.yeastBrand, nutrients.yeastStrain].filter(v => typeof v === "string").join(" "));
    if (yeast) parts.push(yeast);
    details.subject = label(parts.join(" · "));
  }
  const rows = Array.isArray(outer.result) ? outer.result : Array.isArray(result.items) ? result.items : undefined;
  if (name === "summarize_brew_sensor_history" && typeof result.sampleCount === "number" && result.sampleCount <= 100_000) details.count = result.sampleCount;
  if (rows) details.count = Math.min(rows.length, 100_000);
  if (outer.status === "not_found") details.issue = "not_found";
  else if (outer.status === "unavailable") details.issue = "unavailable";
  else if (outer.status === "invalid_input") details.issue = "invalid_input";
  else if (outer.status === "error") details.issue = name === "fetch_wiki_page" ? "source_unavailable" : "lookup_failed";
  if (name === "fetch_wiki_page") {
    if (outer.status === "invalid_input" && Array.isArray(outer.issues) && outer.issues.includes("Select a non-recipe page returned by the current wiki search before fetching it.")) details.issue = "source_not_approved";
    const http = typeof outer.message === "string" ? /^Wiki retrieval failed with HTTP ([45]\d{2})\.$/.exec(outer.message) : null;
    if (outer.status === "error" && http) {
      details.issue = "source_http_error";
      details.httpStatus = Number(http[1]);
    }
  }
  if (outer.status === "ok" && result.status === "needs_input") {
    details.issue = "missing_inputs";
    const missing = new Set<NonNullable<ChatToolProgressDetail["missing"]>[number]>();
    for (const q of Array.isArray(result.questions) ? result.questions : []) {
      const id = String(object(q).id ?? "");
      if (id === "batch_volume") missing.add("batch_size");
      else if (id === "fermentation_final_gravity") missing.add("fermentation_gravity");
      else if (id === "backsweetening_target") missing.add("sweetness");
      else if (/yeast|nitrogen/.test(id)) missing.add("yeast");
      else if (id === "nutrient_plan") missing.add("nutrients");
      else if (/^ingredient_\d+_amount$/.test(id)) missing.add("ingredient_amount");
      else if (/^additive_\d+_amount$/.test(id)) missing.add("additive_amount");
      else if (/ingredient/.test(id)) missing.add("ingredients");
    }
    if (missing.size) details.missing = [...missing];
  }
  if (outer.status === "ok" && result.status === "error") {
    details.issue = result.code === "invalid_input" ? "invalid_input" : "calculation_failed";
    if (result.code === "calculation_failed" && typeof result.message === "string" && /volume|room|fill/i.test(result.message)) details.issue = "volume_conflict";
  }
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}
