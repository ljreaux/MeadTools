import assert from "node:assert/strict";
import test from "node:test";
import {
  PREMIUM_PLANS,
  premiumAllowanceSchedule,
  duePremiumAllowances,
} from "../src/index";

function annual(start = "2026-01-31T15:42:03.123Z", end = "2027-01-31T15:42:03.123Z") {
  return premiumAllowanceSchedule({ interval: "year", periodStart: new Date(start), periodEnd: new Date(end) });
}

test("annual Premium costs ten monthly payments and includes twelve monthly allowances", () => {
  assert.equal(PREMIUM_PLANS.year.priceCents, 5_000);
  assert.equal(PREMIUM_PLANS.year.priceCents, PREMIUM_PLANS.month.priceCents * 10);
  const schedule = annual();
  assert.equal(schedule.length, 12);
  assert.equal(schedule.reduce((total, grant) => total + grant.credits, 0), 12_000);
  assert.deepEqual(schedule.map(({ index }) => index), Array.from({ length: 12 }, (_, i) => i));
});

test("month-end allowances clamp short months and return to the original day", () => {
  const schedule = annual();
  assert.deepEqual(schedule.slice(0, 4).map(({ dueAt }) => dueAt.toISOString()), [
    "2026-01-31T15:42:03.123Z", "2026-02-28T15:42:03.123Z",
    "2026-03-31T15:42:03.123Z", "2026-04-30T15:42:03.123Z",
  ]);
  assert.equal(schedule[11].dueAt.toISOString(), "2026-12-31T15:42:03.123Z");
});

test("leap-day and December anchors preserve UTC time across year and DST boundaries", () => {
  const leap = annual("2028-02-29T08:30:00.000Z", "2029-02-28T08:30:00.000Z");
  assert.equal(leap[1].dueAt.toISOString(), "2028-03-29T08:30:00.000Z");
  assert.equal(leap[11].dueAt.toISOString(), "2029-01-29T08:30:00.000Z");
  const december = annual("2027-12-31T08:30:00.000Z", "2028-12-31T08:30:00.000Z");
  assert.equal(december[2].dueAt.toISOString(), "2028-02-29T08:30:00.000Z");
  assert.equal(december[3].dueAt.toISOString(), "2028-03-31T08:30:00.000Z");
});

test("monthly billing retains one allowance, with independent Date instances", () => {
  const periodStart = new Date("2026-11-10T12:00:00Z");
  const schedule = premiumAllowanceSchedule({ interval: "month", periodStart, periodEnd: new Date("2026-12-10T12:00:00Z") });
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].credits, 1_000);
  assert.equal(schedule[0].dueAt.getTime(), periodStart.getTime());
  assert.notEqual(schedule[0].dueAt, periodStart);
});

test("delivery catches up only due, ungranted allowances, including exact boundaries", () => {
  const schedule = annual();
  assert.deepEqual(duePremiumAllowances({ schedule, grantedIndexes: new Set(), now: new Date("2026-01-31T15:42:03.122Z") }), []);
  assert.deepEqual(duePremiumAllowances({ schedule, grantedIndexes: new Set([0]), now: schedule[2].dueAt }).map(({ index }) => index), [1, 2]);
  assert.deepEqual(duePremiumAllowances({ schedule, grantedIndexes: new Set([0, 1, 2]), now: schedule[2].dueAt }), []);
});

test("a late worker still owes all paid allowances, but no thirteenth grant", () => {
  const schedule = annual();
  const missed = duePremiumAllowances({ schedule, grantedIndexes: new Set([0]), now: new Date("2028-01-01T00:00:00Z") });
  assert.equal(missed.length, 11);
  assert.equal(missed.at(-1)?.index, 11);
});

test("invalid, reversed and insufficient paid periods fail before any schedule is returned", () => {
  for (const [start, end] of [
    ["invalid", "2027-01-01"], ["2026-01-01", "invalid"],
    ["2026-01-01", "2026-01-01"], ["2027-01-01", "2026-01-01"],
    ["2026-01-01", "2026-11-01"],
  ]) assert.throws(() => annual(start, end), RangeError);
  assert.throws(() => duePremiumAllowances({ schedule: annual(), grantedIndexes: new Set(), now: new Date(NaN) }), RangeError);
});
