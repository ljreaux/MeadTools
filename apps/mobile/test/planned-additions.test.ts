import assert from "node:assert/strict";
import test from "node:test";

import type { BrewResponse } from "@meadtools/api-contract";
import { buildBrewAddition, plannedAdditionMetadata } from "@meadtools/brew-domain/planned-additions";
import { buildBrewRecipeStageData } from "@meadtools/brew-domain/recipe-stage";

import { traditionalRecipeFixture } from "../../web/lib/utils/__fixtures__/recipeDerivedFixtures";
import { buildPlannedAddition, plannedAdditionRows } from "../src/entries/planned-additions";
import { createOutboxRecord, withDelivery } from "../src/outbox/entry-outbox-record";
import { ACCOUNT_A, uuidSequence } from "./support/outbox-fakes";

const datetime = "2026-11-09T15:30:00.000Z";
const nextId = uuidSequence();
const brew = {
  id: "test-brew",
  recipe_snapshot: { dataV2: traditionalRecipeFixture },
  current_volume_liters: null,
  latest_gravity: null,
  entries: []
} as unknown as BrewResponse;
const nutrientName = (index: number) => `Nutrient addition ${index}`;
const translate = (_key: string, fallback: string) => fallback;

test("planned ingredient matches the web payload, preserves the plan, and counts once across delivery", () => {
  const row = plannedAdditionRows(brew, [], nutrientName).rows.find(({ id }) => id === "ingredient:traditional-honey")!;
  assert.equal(row.amount, 3);
  const actual = { amount: 2.25, name: row.name, note: " Adjusted ", datetime, stage: "PRIMARY" };
  const payload = buildPlannedAddition(row, actual, translate);
  assert.deepEqual(payload, buildBrewAddition({
    name: row.name, amount: 2.25, unit: "lb", note: "Adjusted", datetime,
    kind: "INGREDIENT", source: "recipe_ingredient", recipeIngredientId: "traditional-honey",
    meta: plannedAdditionMetadata(row, { name: row.name, basis: "weight", stage: "PRIMARY" })
  }, translate));
  assert.equal(payload.data.meta?.plannedAmount, 3);

  const queued = createOutboxRecord({
    account: ACCOUNT_A, clientEntryId: nextId(), now: Date.parse(datetime), input: { brewId: brew.id, payload }
  });
  const rowStatus = (response: BrewResponse, queue: typeof queued[]) =>
    plannedAdditionRows(response, queue, nutrientName).rows.find(({ id }) => id === row.id)?.status;
  assert.equal(rowStatus(brew, [queued]), "queued");
  assert.equal(rowStatus(brew, [withDelivery(queued, { ...queued.delivery, status: "terminal_failure" })]), "available");

  const serverEntry = {
    id: queued.clientEntryId, type: payload.type, datetime, title: payload.title ?? null, note: payload.note,
    gravity: null, temperature: null, temp_units: null, user_id: 7, data: JSON.parse(JSON.stringify(payload.data))
  };
  const confirmed = { ...brew, entries: [serverEntry] };
  assert.equal(rowStatus(confirmed, [queued]), "logged");
  const web = buildBrewRecipeStageData({
    recipeSnapshot: confirmed.recipe_snapshot, currentVolumeLiters: null, latestGravity: null, entries: confirmed.entries
  });
  assert.deepEqual(web.actual.loggedRecipeIngredientIds, ["traditional-honey"]);
});

test("actual pitch drives Go-Ferm and queued nutrient components reduce remaining grams", () => {
  const plan = plannedAdditionRows(brew, [], nutrientName);
  const pitch = plan.rows.find(({ id }) => id === "yeast")!;
  assert.equal(pitch.source, "recipe_yeast");
  const yeast = buildPlannedAddition(pitch, {
    amount: 8, name: pitch.name, note: "", datetime
  }, translate);
  const queue = [createOutboxRecord({
    account: ACCOUNT_A, clientEntryId: nextId(), now: Date.parse(datetime), input: { brewId: brew.id, payload: yeast }
  })];
  const afterPitch = plannedAdditionRows(brew, queue, nutrientName);
  const goFerm = afterPitch.rows.find(({ id }) => id === "go-ferm")!;
  assert.equal(goFerm.amount, 10);
  assert.equal(goFerm.meta?.plannedWaterAmount, 200);

  const nutrient = afterPitch.rows.find(({ id }) => id === "nutrient:1")!;
  const components = nutrient.components!.map((component) => ({ ...component, amount: 0.2 }));
  const payload = buildPlannedAddition(nutrient, {
    amount: 0.2, name: nutrient.name, components, note: "", datetime, stage: "PRIMARY"
  }, translate);
  assert.equal(payload.data.meta?.nutrientAdditionIndex, 1);
  assert.deepEqual(payload.data.meta?.components, components);
  queue.push(createOutboxRecord({
    account: ACCOUNT_A, clientEntryId: nextId(), now: Date.parse(datetime), input: { brewId: brew.id, payload }
  }));
  const afterNutrients = plannedAdditionRows(brew, queue, nutrientName);
  assert.equal(afterNutrients.rows.find(({ id }) => id === "nutrient:1")?.status, "queued");
  assert.ok(afterNutrients.remaining.fermO < afterPitch.remaining.fermO);
});

test("skipping Go-Ferm records the web decision and cannot zero another planned item", () => {
  const { rows } = plannedAdditionRows(brew, [], nutrientName);
  const goFerm = rows.find(({ id }) => id === "go-ferm")!;
  const skipped = buildPlannedAddition(goFerm, { name: goFerm.name, note: "", datetime, skipGoFerm: true }, translate);
  assert.equal(skipped.data.amount, 0);
  assert.equal(skipped.data.meta?.goFermUsed, false);
  assert.equal(skipped.data.meta?.plannedWaterAmount, goFerm.meta?.recipePlannedWaterAmount);
  const water = rows.find(({ id }) => id === "ingredient:traditional-water")!;
  const addition = buildPlannedAddition(water, { name: water.name, note: "", datetime, amount: 0.7, skipGoFerm: true }, translate);
  assert.equal(addition.data.amount, 0.7);
  assert.equal(addition.data.meta?.goFermUsed, undefined);
});
