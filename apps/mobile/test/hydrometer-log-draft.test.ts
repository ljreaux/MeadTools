import assert from "node:assert/strict";
import test from "node:test";
import { logDraft, parseLogDraft } from "../src/hydrometers/log-draft";
const log = {
  id: "log",
  device_id: "device",
  brew_id: "brew",
  datetime: "2026-11-27T00:00:00Z",
  gravity: 1.1,
  calculated_gravity: 1.099,
  temperature: 20,
  temp_units: "C" as const,
  angle: 22,
  battery: 3.7,
  interval: 600
};
test("log edits preserve measured and calibrated gravity and send the API's dateTime field", () => {
  const draft = logDraft(log);
  const input = parseLogDraft({ ...draft, gravity: "1,050", dateTime: "2026-11-27T01:00:00Z" });
  assert.equal(input?.gravity, 1.05);
  assert.equal(input?.calculated_gravity, 1.099);
  assert.equal(input?.dateTime, "2026-11-27T01:00:00Z");
  assert.equal(input && "device_id" in input, false);
  assert.equal(parseLogDraft({ ...draft, calculated_gravity: "" })?.calculated_gravity, undefined);
});
test("partial numeric edits, empty required fields, invalid dates and fractional intervals cannot save", () => {
  const draft = logDraft(log);
  for (const patch of [
    { gravity: "1." },
    { gravity: "" },
    { gravity: "Infinity" },
    { interval: "1.5" },
    { interval: "-1" },
    { dateTime: "not a date" }
  ])
    assert.equal(parseLogDraft({ ...draft, ...patch }), null);
});
test("a Kelvin log opens with an equivalent Fahrenheit value without relabeling Kelvin as Fahrenheit", () => {
  const draft = logDraft({ ...log, temperature: 293.15, temp_units: "K" });
  assert.equal(draft.temp_units, "F");
  assert.ok(Math.abs(Number(draft.temperature) - 68) < 0.00001);
});
