import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { instance } from "@viz-js/viz";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "docs/database");
const schemaPath = "apps/web/prisma/schema.prisma";
const require = createRequire(import.meta.url);
const hash = (text) => createHash("sha256").update(text).digest("hex");
const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function lexicalTokens(source) {
  return (source.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[^\s]/g) ?? [])
    .filter((token) => !token.startsWith("//") && !token.startsWith("/*"));
}
export function schemaTokens(source) {
  // Prisma's formatter groups block-level constraints. Their order is not
  // semantic, while string literals and field declarations must stay intact.
  const normalized = source.replace(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm, (_, name, body) => {
    const attributes = [];
    const fields = body.replace(/^\s*@@[a-zA-Z]+\([\s\S]*?\)[\t ]*$/gm, (attribute) => {
      attributes.push(lexicalTokens(attribute).join(" "));
      return "";
    });
    return `model ${name} {${fields}\n${attributes.sort().join("\n")}\n}`;
  });
  return lexicalTokens(normalized).join("\n");
}
const same = (a, b) => a.length === b.length && a.every((item) => b.includes(item));
const areas = {
  brewing: { name: "Brewing & hydrometers", color: "#e0f2fe" },
  inventory: { name: "Inventory & equipment", color: "#dcfce7" },
  billing: { name: "Billing & premium", color: "#fef3c7" },
  chat: { name: "Chat & model usage", color: "#f3e8ff" },
  identity: { name: "Identity, authentication & MCP", color: "#ffe4e6" },
  recipes: { name: "Recipes, catalog & community", color: "#ffedd5" },
  other: { name: "Other tables", color: "#e2e8f0" },
};
function area(name) {
  if (/^(inventory_|equipment)/.test(name)) return "inventory";
  if (/^(credit_|premium_)/.test(name)) return "billing";
  if (/^chat/.test(name)) return "chat";
  if (/^mcp_/.test(name) || ["users", "User", "Account", "Session", "VerificationToken"].includes(name)) return "identity";
  if (["brews", "brew_entries", "brew_images", "devices", "logs"].includes(name)) return "brewing";
  if (["recipes", "ingredients", "yeasts", "additives", "nutrient_presets", "BjcpIngredient", "comments", "recipe_ratings", "recipe_daily_activity"].includes(name)) return "recipes";
  return "other";
}
export function buildMetadata(datamodel, schema) {
  const models = datamodel.models.map((model) => {
    const body = schema.match(new RegExp(`^model\\s+${model.name}\\s*\\{([\\s\\S]*?)^\\}`, "m"))?.[1];
    assert.ok(body !== undefined, `Missing schema source for ${model.name}`);
    const fields = model.fields.filter((field) => field.kind !== "object").map((field) => ({
      name: field.name, column: field.dbName ?? field.name, type: field.type,
      nativeType: field.nativeType ? `${field.nativeType[0]}${field.nativeType[1].length ? `(${field.nativeType[1].join(",")})` : ""}` : null,
      nullable: !field.isRequired, list: field.isList, enum: field.kind === "enum",
      primary: field.isId || !!model.primaryKey?.fields.includes(field.name), unique: field.isUnique,
      ...(field.hasDefaultValue ? { default: field.default } : {}), updatedAt: field.isUpdatedAt,
      documentation: field.documentation ?? null,
    }));
    const unique = [
      ...fields.filter((field) => field.primary || field.unique).filter((field) => !model.primaryKey || field.unique).map((field) => [field.name]),
      ...(model.primaryKey ? [model.primaryKey.fields] : []), ...model.uniqueFields,
    ];
    return { name: model.name, table: model.dbName ?? model.name, area: area(model.name), documentation: model.documentation ?? null,
      fields, primaryKey: model.primaryKey?.fields ?? fields.filter((field) => field.primary).map((field) => field.name), unique,
      indexes: [...body.matchAll(/^\s*@@(?:index|unique|id|fulltext)\([\s\S]*?\)\s*$/gm)].map((match) => match[0].trim()),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "en"));
  const byName = new Map(models.map((model) => [model.name, model]));
  const foreignKeys = [];
  for (const model of datamodel.models) for (const relation of model.fields.filter((field) => field.kind === "object")) {
    if (!relation.relationFromFields?.length) {
      const implicit = relation.isList && datamodel.models.find((target) => target.name === relation.type)?.fields.some((inverse) =>
        inverse.kind === "object" && inverse.isList && inverse.relationName === relation.relationName &&
        !(model.name === relation.type && inverse.name === relation.name));
      assert.ok(!implicit, `Implicit many-to-many ${relation.relationName} needs explicit junction-table ERD support`);
      continue;
    }
    const child = byName.get(model.name), parent = byName.get(relation.type);
    assert.ok(parent, `Unknown relation target ${relation.type}`);
    for (const field of relation.relationFromFields) assert.ok(child.fields.some((row) => row.name === field), `Unknown FK field ${model.name}.${field}`);
    for (const field of relation.relationToFields) assert.ok(parent.fields.some((row) => row.name === field), `Unknown referenced field ${parent.name}.${field}`);
    const one = child.unique.some((key) => key.every((field) => relation.relationFromFields.includes(field)));
    foreignKeys.push({ id: `${model.name}_${relation.name}`, child: model.name, parent: parent.name,
      name: relation.relationName, from: relation.relationFromFields, to: relation.relationToFields,
      parentCardinality: relation.isRequired ? "1" : "0..1", childCardinality: one ? "0..1" : "0..N",
      onDelete: relation.relationOnDelete ?? (relation.isRequired ? "Restrict (Prisma default)" : "SetNull (Prisma default)"),
      onUpdate: relation.relationOnUpdate ?? "Cascade (Prisma default)",
    });
  }
  foreignKeys.sort((a, b) => a.id.localeCompare(b.id, "en"));
  for (const model of models) for (const field of model.fields) {
    field.foreignKeys = foreignKeys.filter((fk) => fk.child === model.name && fk.from.includes(field.name)).map((fk) => fk.id);
    field.uniqueGroups = model.unique.filter((key) => key.includes(field.name) && !same(key, model.primaryKey));
  }
  return { models, foreignKeys, enums: datamodel.enums };
}
function typeLabel(field) { return `${field.nativeType ?? field.type}${field.list ? "[]" : ""}${field.nullable ? "?" : ""}`; }
function keyLabel(field) { return [field.primary && "PK", field.foreignKeys.length && "FK", field.uniqueGroups.length && "UK"].filter(Boolean).join(", "); }
export function diagramGraph(metadata, scope) {
  const overview = scope === "overview", full = scope === "full" || overview;
  const own = new Set(metadata.models.filter((model) => full || model.area === scope).map((model) => model.name));
  const relations = metadata.foreignKeys.filter((fk) => own.has(fk.child));
  const included = new Set([...own, ...relations.map((fk) => fk.parent)]);
  const nodes = metadata.models.filter((model) => included.has(model.name)).map((model) => {
    const boundary = !own.has(model.name);
    const referenced = relations.filter((fk) => fk.parent === model.name).flatMap((fk) => fk.to);
    const fields = overview ? [] : model.fields.filter((field) => !boundary || field.primary || referenced.includes(field.name));
    const rows = fields.map((field) => `<TR><TD PORT="f_${field.name}" ALIGN="LEFT">${escape(keyLabel(field))}</TD><TD ALIGN="LEFT">${escape(field.column)}</TD><TD ALIGN="LEFT">${escape(typeLabel(field))}</TD></TR>`).join("");
    return { name: model.name, attributes: { id: `table_${model.name}`, shape: "plain",
      tooltip: `${model.table} — ${areas[model.area].name}${boundary ? " (related table; keys only)" : ""}`,
      label: { html: `<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="6" COLOR="#94a3b8" BGCOLOR="white"><TR><TD PORT="header" COLSPAN="3" BGCOLOR="${areas[model.area].color}"><B>${escape(model.table)}</B>${boundary ? " (related keys)" : ""}</TD></TR>${rows}</TABLE>` },
    } };
  });
  return { directed: true, graphAttributes: { rankdir: "LR", bgcolor: "white", pad: .4, nodesep: .35, ranksep: 1.2, splines: "ortho", outputorder: "edgesfirst" },
    nodeAttributes: { fontname: "Arial", fontsize: 11 }, edgeAttributes: { color: "#64748b", fontname: "Arial", fontsize: 9, arrowsize: .65 }, nodes,
    edges: relations.map((fk) => ({ tail: fk.child, head: fk.parent, attributes: {
      id: `fk_${fk.id}`, tailport: overview ? "header" : `f_${fk.from[0]}`, headport: overview ? "header" : `f_${fk.to[0]}`,
      headlabel: overview ? "" : fk.parentCardinality, taillabel: overview ? "" : fk.childCardinality, labeldistance: 2,
      tooltip: `${fk.child} (${fk.from.join(", ")}) -> ${fk.parent} (${fk.to.join(", ")}); ${fk.childCardinality} child / ${fk.parentCardinality} parent; delete: ${fk.onDelete}; update: ${fk.onUpdate}`,
    } })),
  };
}
function dictionary(metadata, fingerprint, views) {
  const lines = ["# Database ERD", "", "Generated from `apps/web/prisma/schema.prisma`; regenerate with `npm run db:erd`. Do not edit generated files by hand.", "",
    `**${metadata.models.length} tables · ${metadata.models.reduce((n, m) => n + m.fields.length, 0)} columns · ${metadata.foreignKeys.length} foreign keys · ${metadata.enums.length} enums.**`, "",
    "Open [the interactive viewer](./erd.html) locally in your browser for search, zoom, pan, and focused areas. It works offline and contains no account or database data.", "",
    "The SVGs below are directly viewable in the repository and on GitHub:", "",
    ...views.map((view) => `- [${view.name}](./${view.id}.svg)`), "",
    "![Database overview](./overview.svg)", "", "## Reading the diagrams", "",
    "- Every Prisma model is present, including unconnected tables and both `users` and the distinct `User` authentication table. Mapped SQL table/column names are shown.",
    "- Full and focused diagrams show columns, native/Prisma types, nullable `?` markers, PK, FK and UK membership. A UK marker can mean part of a compound unique key; consult the dictionary below for its tuple.",
    "- Arrows run from referencing columns to their referenced table. The child end is `0..N` or `0..1`; the parent end is `1` or `0..1`. Minimum child participation is zero: a foreign key does not require a parent to have children.",
    "- Hover over an edge for the complete composite FK and delete/update actions. Focused views include referenced tables as keys-only context; their other outgoing edges are intentionally omitted there.",
    "- Historical IDs, JSON snapshots and polymorphic references without a Prisma relation are columns, not invented FK edges. The ERD describes the checked-in schema, not live database state. SQL-only checks, triggers, RLS and partial/expression indexes must be reviewed in migration SQL; they are outside Prisma's datamodel.", "",
    "## Schema and migration fingerprints", "", `Schema SHA-256: \`${fingerprint.schema}\``, "", `Migration-set SHA-256: \`${fingerprint.migrations}\``, "",
    "Both fingerprints are checked by `npm run db:erd:check`; adding or editing a migration requires regenerating these artifacts even when model geometry is unchanged.", "", "## Table index", "",
    ...metadata.models.map((model) => `- [${model.table}](#table-${model.name.toLowerCase()}) — ${areas[model.area].name}`), "", "## Data dictionary", ""];
  for (const model of metadata.models) {
    lines.push(`<a id="table-${model.name.toLowerCase()}"></a>`, "", `### ${model.table}`, "", `Prisma model: \`${model.name}\`. Area: ${areas[model.area].name}.`, "");
    if (model.documentation) lines.push(model.documentation.replaceAll("\n", " "), "");
    lines.push("| Column | Type | Keys | Default / behavior |", "| --- | --- | --- | --- |");
    for (const field of model.fields) lines.push(`| \`${field.column}\` | \`${typeLabel(field)}\`${field.enum ? ` ([enum](#enum-${field.type.toLowerCase()}))` : ""} | ${keyLabel(field)} | ${escape(field.default === undefined ? "" : JSON.stringify(field.default)).replaceAll("|", "&#124;")}${field.updatedAt ? " @updatedAt" : ""} |`);
    lines.push("", `Primary key: ${model.primaryKey.length ? model.primaryKey.map((field) => `\`${field}\``).join(", ") : "none declared"}.`, "");
    if (model.indexes.length) lines.push("Declared table indexes/constraints:", "", ...model.indexes.map((index) => `- \`${index.replaceAll("\n", " ")}\``), "");
    const fks = metadata.foreignKeys.filter((fk) => fk.child === model.name);
    if (fks.length) lines.push("Foreign keys:", "", ...fks.map((fk) => `- (${fk.from.map((f) => `\`${f}\``).join(", ")}) → \`${fk.parent}\` (${fk.to.map((f) => `\`${f}\``).join(", ")}); delete **${fk.onDelete}**, update **${fk.onUpdate}**.`), "");
  }
  lines.push("## Enums", "");
  for (const item of metadata.enums) lines.push(`<a id="enum-${item.name.toLowerCase()}"></a>`, "", `### ${item.name}`, "", item.values.map((v) => `\`${v.name}\`${v.dbName ? ` (SQL: \`${v.dbName}\`)` : ""}`).join(", "), "");
  return lines.join("\n");
}
export async function generate({ check = false, outputDirectory = output, migrationDirectory = path.join(root, "apps/web/prisma/migrations") } = {}) {
  const schema = await readFile(path.join(root, schemaPath), "utf8");
  const generatedSchema = await readFile(require.resolve(".prisma/client/schema.prisma"), "utf8");
  assert.ok(schemaTokens(generatedSchema) === schemaTokens(schema), "Prisma client is stale; run npm run prisma:generate --workspace @meadtools/web first");
  const migrationRoot = migrationDirectory;
  const migrations = [];
  for (const dir of (await readdir(migrationRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    migrations.push({ name: dir.name, sha256: hash(await readFile(path.join(migrationRoot, dir.name, "migration.sql"), "utf8")) });
  }
  const fingerprint = { schema: hash(schema), migrations: hash(JSON.stringify(migrations)) };
  const metadata = buildMetadata(Prisma.dmmf.datamodel, schema);
  const views = [{ id: "overview", name: "Overview — every table" }, { id: "full", name: "Complete schema — every column" },
    ...Object.entries(areas).filter(([id]) => metadata.models.some((model) => model.area === id)).map(([id, info]) => ({ id, name: info.name }))];
  const viz = await instance();
  const generated = new Map();
  for (const view of views) {
    const graph = diagramGraph(metadata, view.id);
    const rendered = viz.render(graph, { format: "svg" });
    assert.equal(rendered.status, "success", `Cannot render ${view.id}: ${JSON.stringify(rendered.errors)}`);
    assert.ok(!rendered.errors.some((error) => error.level === "warning"), `Diagram warning in ${view.id}: ${JSON.stringify(rendered.errors)}`);
    let svg = rendered.output.slice(rendered.output.indexOf("<svg"));
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1 role="img" aria-label="${escape(view.name)}"><metadata>${escape(JSON.stringify(fingerprint))}</metadata>`);
    generated.set(`${view.id}.svg`, svg);
  }
  generated.set("schema.json", `${JSON.stringify({ fingerprint, migrations, ...metadata }, null, 2)}\n`);
  generated.set("README.md", dictionary(metadata, fingerprint, views));
  const template = await readFile(path.join(root, "scripts/templates/database-erd.html"), "utf8");
  generated.set("erd.html", template.replace("<!-- COUNTS -->", `${metadata.models.length} tables · ${metadata.foreignKeys.length} relationships`)
    .replace("<!-- VIEWS -->", views.map((view) => `<option value="${view.id}">${escape(view.name)}</option>`).join("\n"))
    .replace("<!-- TABLES -->", metadata.models.map((model) => `<button type="button" data-model="${model.name}">${escape(model.table)}<small>${escape(areas[model.area].name)}</small></button>`).join("\n"))
    .replace("<!-- SVGS -->", views.map((view) => `<template id="view-${view.id}">${generated.get(`${view.id}.svg`)}</template>`).join("\n")));
  const stale = [];
  if (!check) await mkdir(outputDirectory, { recursive: true });
  for (const [name, content] of generated) {
    if (check) {
      const existing = await readFile(path.join(outputDirectory, name), "utf8").catch((error) => { if (error.code === "ENOENT") return null; throw error; });
      if (existing !== content) stale.push(name);
    } else await writeFile(path.join(outputDirectory, name), content);
  }
  for (const id of Object.keys(areas)) if (!views.some((view) => view.id === id)) {
    const file = path.join(outputDirectory, `${id}.svg`);
    const exists = await readFile(file).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error; });
    if (exists) { if (check) stale.push(`${id}.svg (obsolete)`); else await unlink(file); }
  }
  assert.equal(stale.length, 0, `Database ERD is stale: ${stale.join(", ")}. Run npm run db:erd and commit the results.`);
  console.log(`${check ? "Verified" : "Generated"} ERD: ${metadata.models.length} tables, ${metadata.foreignKeys.length} relationships, ${views.length} views. No database connection used.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.ok(process.argv.slice(2).every((arg) => arg === "--check"), "Supported argument: --check");
  await generate({ check: process.argv.includes("--check") });
}
