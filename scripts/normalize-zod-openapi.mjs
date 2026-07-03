import { readFile, writeFile } from "node:fs/promises";

const documentUrl = new URL("../public/openapi.json", import.meta.url);
const aliasesUrl = new URL(
  "../packages/api-contract/src/zod/openapi-aliases.ts",
  import.meta.url
);
const parametersUrl = new URL(
  "../packages/api-contract/openapi-parameters.json",
  import.meta.url
);
const document = JSON.parse(await readFile(documentUrl, "utf8"));
const aliasesSource = await readFile(aliasesUrl, "utf8");
const operationParameters = JSON.parse(await readFile(parametersUrl, "utf8"));
const schemaToPublicName = new Map(
  Array.from(
    aliasesSource.matchAll(/^export const (\w+) = (\w+Schema);$/gm),
    (match) => [match[2], match[1]]
  )
);
const schemas = document.components?.schemas ?? {};

function rewriteReferences(value) {
  if (Array.isArray(value)) return value.map(rewriteReferences);
  if (!value || typeof value !== "object") return value;

  const rewritten = {};
  for (const [key, child] of Object.entries(value)) {
    if (
      key === "$ref" &&
      typeof child === "string" &&
      child.startsWith("#/components/schemas/")
    ) {
      const name = child.slice("#/components/schemas/".length);
      const publicName = schemaToPublicName.get(name);
      rewritten[key] = publicName
        ? `#/components/schemas/${publicName}`
        : child;
    } else {
      rewritten[key] = rewriteReferences(child);
    }
  }
  return rewritten;
}

for (const [schemaName, publicName] of schemaToPublicName) {
  if (schemas[schemaName]) {
    schemas[publicName] = rewriteReferences(schemas[schemaName]);
  }
}
const rewrittenDocument = rewriteReferences(document);
const rewrittenSchemas = rewrittenDocument.components?.schemas ?? {};
const referenced = new Set();

function collectReferences(value) {
  if (Array.isArray(value)) {
    value.forEach(collectReferences);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      key === "$ref" &&
      typeof child === "string" &&
      child.startsWith("#/components/schemas/")
    ) {
      const name = child.slice("#/components/schemas/".length);
      if (!referenced.has(name)) {
        referenced.add(name);
        collectReferences(rewrittenSchemas[name]);
      }
    } else if (key !== "schemas") {
      collectReferences(child);
    }
  }
}

collectReferences(rewrittenDocument.paths);
for (const name of Array.from(referenced)) {
  collectReferences(rewrittenSchemas[name]);
}
rewrittenDocument.components.schemas = Object.fromEntries(
  Object.entries(rewrittenSchemas).filter(([name]) => referenced.has(name))
);
for (const [path, pathItem] of Object.entries(rewrittenDocument.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    const parameters = operationParameters[`${method.toUpperCase()} ${path}`];
    if (parameters) operation.parameters = parameters;
  }
}

await writeFile(documentUrl, `${JSON.stringify(rewrittenDocument, null, 2)}\n`);
