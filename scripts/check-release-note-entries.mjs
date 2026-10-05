import { readFileSync } from "node:fs";

const path = new URL(
  "../packages/i18n/locales/en/default.json",
  import.meta.url,
);
const entries = JSON.parse(readFileSync(path, "utf8")).releaseNotes?.entries;
const products = new Set(["web", "mobile", "mobilePreview", "chat", "api"]);

if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
  throw new Error("releaseNotes.entries must be an object");
}

for (const [date, release] of Object.entries(entries)) {
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate) throw new Error(`Invalid release date: ${date}`);
  if (typeof release?.title !== "string" || !release.title.trim()) {
    throw new Error(`${date}: title is required`);
  }
  if (typeof release?.summary !== "string" || !release.summary.trim()) {
    throw new Error(`${date}: summary is required`);
  }
  const sections = release.products;
  if (
    !sections ||
    typeof sections !== "object" ||
    Array.isArray(sections) ||
    Object.keys(sections).length === 0
  ) {
    throw new Error(`${date}: at least one product section is required`);
  }
  for (const [product, section] of Object.entries(sections)) {
    if (!products.has(product))
      throw new Error(`${date}: unknown product ${product}`);
    if (
      !Array.isArray(section?.items) ||
      section.items.length === 0 ||
      section.items.some((item) => typeof item !== "string" || !item.trim())
    ) {
      throw new Error(`${date}: ${product} requires nonempty items`);
    }
  }
}

console.log(
  `Validated ${Object.keys(entries).length} dated release note entries.`,
);
