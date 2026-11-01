import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildMetadata, diagramGraph, generate, schemaTokens } from "./generate-database-erd.mjs";
const schema = await readFile(new URL("../apps/web/prisma/schema.prisma", import.meta.url), "utf8");
const metadata = buildMetadata(Prisma.dmmf.datamodel, schema);

test("the full ERD includes every table, column and declared FK, including disconnected and mapped tables", () => {
  const graph = diagramGraph(metadata, "full");
  assert.equal(graph.nodes.length, Prisma.dmmf.datamodel.models.length);
  assert.equal(metadata.models.reduce((n, model) => n + model.fields.length, 0),
    Prisma.dmmf.datamodel.models.reduce((n, model) => n + model.fields.filter((field) => field.kind !== "object").length, 0));
  assert.equal(graph.edges.length, Prisma.dmmf.datamodel.models.reduce((n, model) => n + model.fields.filter((field) => field.relationFromFields?.length).length, 0));
  assert.ok(graph.nodes.some((node) => node.name === "User"));
  assert.ok(graph.nodes.some((node) => node.name === "users"));
  assert.equal(metadata.models.find((model) => model.name === "BjcpIngredient").table, "bjcp-ingredients");
  assert.ok(metadata.models.find((model) => model.name === "brew_images").fields.some((field) => field.name === "original_brew_id"));
  assert.ok(!metadata.foreignKeys.some((fk) => fk.child === "brew_images" && fk.from.includes("original_brew_id")), "Historical source IDs are not database FKs");
});
test("compound ownership keys, optional self references and one-to-one cardinality remain accurate", () => {
  const stock = metadata.foreignKeys.find((fk) => fk.id === "inventory_consumptions_stock");
  assert.deepEqual(stock.from, ["stock_id", "user_id", "unit"]);
  assert.deepEqual(stock.to, ["id", "user_id", "unit"]);
  assert.equal(stock.parentCardinality, "1");
  assert.equal(stock.childCardinality, "0..N");
  const tree = metadata.foreignKeys.find((fk) => fk.id === "comments_parent");
  assert.equal(tree.parent, tree.child);
  assert.equal(tree.parentCardinality, "0..1");
  const account = metadata.foreignKeys.find((fk) => fk.child === "credit_accounts" && fk.parent === "users");
  assert.equal(account.childCardinality, "0..1");
  assert.ok(metadata.models.find((model) => model.name === "inventory_stock").indexes.some((index) => index.includes("@@index([user_id, archived_at])")));
});
test("focused views show all area tables and only necessary related-key context", () => {
  const graph = diagramGraph(metadata, "inventory");
  assert.ok(graph.nodes.some((node) => node.name === "inventory_stock"));
  assert.ok(graph.nodes.some((node) => node.name === "users"));
  assert.ok(!graph.nodes.some((node) => node.name === "chat_messages"));
  assert.ok(!graph.nodes.find((node) => node.name === "users").attributes.label.html.includes("password"));
});
test("client freshness comparison ignores formatting and constraint ordering but preserves literal meaning", () => {
  const a = 'model M {\n id Int @id\n name String @default("two words")\n @@index([name])\n @@unique([id, name])\n}\n';
  const b = 'model M {\n id   Int @id\n name String @default("two words") // note\n @@unique([id, name])\n @@index([name])\n}\n';
  assert.equal(schemaTokens(a), schemaTokens(b));
  assert.notEqual(schemaTokens(a), schemaTokens(b.replace('"two words"', '"twowords"')));
});
test("freshness check detects edited artifacts and removed required diagrams", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "meadtools-erd-"));
  try {
    await generate({ outputDirectory: directory });
    await generate({ check: true, outputDirectory: directory });
    const snapshot = JSON.parse(await readFile(path.join(directory, "schema.json"), "utf8"));
    assert.ok(snapshot.migrations.length > 0);
    assert.ok(snapshot.migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.sha256)));
    const full = await readFile(path.join(directory, "full.svg"), "utf8");
    assert.equal((full.match(/class="edge"/g) ?? []).length, metadata.foreignKeys.length);
    assert.equal((full.match(/class="node"/g) ?? []).length, metadata.models.length);
    await writeFile(path.join(directory, "README.md"), "stale");
    await rm(path.join(directory, "inventory.svg"));
    await assert.rejects(generate({ check: true, outputDirectory: directory }), /Database ERD is stale:.*inventory.svg.*README.md/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("new and edited migrations invalidate the ERD without any schema change", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "meadtools-erd-migrations-"));
  const migrationDirectory = path.join(directory, "migrations");
  const outputDirectory = path.join(directory, "erd");
  try {
    await mkdir(path.join(migrationDirectory, "001_initial"), { recursive: true });
    const sql = path.join(migrationDirectory, "001_initial/migration.sql");
    await writeFile(sql, "-- fixture migration\n");
    await generate({ outputDirectory, migrationDirectory });
    await writeFile(sql, "-- edited fixture migration\n");
    await assert.rejects(generate({ check: true, outputDirectory, migrationDirectory }), /Database ERD is stale/);
    await generate({ outputDirectory, migrationDirectory });
    await mkdir(path.join(migrationDirectory, "002_data_only"));
    await writeFile(path.join(migrationDirectory, "002_data_only/migration.sql"), "-- another fixture migration\n");
    await assert.rejects(generate({ check: true, outputDirectory, migrationDirectory }), /Database ERD is stale/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
