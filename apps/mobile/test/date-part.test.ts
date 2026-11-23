import assert from "node:assert/strict";
import test from "node:test";

import { pickerDayFor, withPickedDay, withPickedTime } from "../src/brews/date-part";

test("the date picker starts on the brew's local day", () => {
  for (const hour of [0, 7, 19, 23]) {
    const current = new Date(2026, 10, 9, hour, 30);
    const day = pickerDayFor(current);
    assert.deepEqual(
      [day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), day.getUTCHours()],
      [2026, 10, 9, 0]
    );
    // Opening the picker and confirming the same day keeps the brew unchanged.
    assert.equal(withPickedDay(day, current).getTime(), current.getTime());
  }
});

test("picking a day keeps the brew's local time of day", () => {
  const current = new Date(2026, 10, 20, 19, 45, 30);
  const picked = new Date(Date.UTC(2026, 2, 1));
  const next = withPickedDay(picked, current);
  assert.deepEqual(
    [next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes()],
    [2026, 2, 1, 19, 45]
  );
  assert.equal(current.getMonth(), 10);
});

test("picking a time keeps the brew's day", () => {
  const current = new Date(2026, 2, 1, 8, 0, 30);
  const next = withPickedTime(new Date(2026, 10, 20, 19, 45), current);
  assert.deepEqual(
    [next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes(), next.getSeconds()],
    [2026, 2, 1, 19, 45, 0]
  );
});
