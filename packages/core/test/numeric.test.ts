import assert from "node:assert/strict";
import test from "node:test";

test("switching a unit straight back restores the typed text", async () => {
  const { switchUnitText } = await import("../src/numeric");
  const toFlOz = (text: string) => String(Math.round(Number(text) * 0.033814 * 10000) / 10000);
  const toMl = (text: string) => String(Math.round(Number(text) * 29.5735 * 10000) / 10000);

  const there = switchUnitText("240", "ml", "floz", toFlOz, null);
  assert.equal(there.text, "8.1154");
  // Converting the rounded value back would give 240.0008.
  assert.equal(toMl(there.text), "240.0008");
  const back = switchUnitText(there.text, "floz", "ml", toMl, there.last);
  assert.equal(back.text, "240");
  assert.equal(back.last, null);

  // An edited value converts normally.
  const edited = switchUnitText("8.5", "floz", "ml", toMl, there.last);
  assert.equal(edited.text, toMl("8.5"));

  // The same unit changes nothing.
  assert.deepEqual(switchUnitText("1", "ml", "ml", toFlOz, there.last), { text: "1", last: there.last });
});

test("temperatures convert to one decimal place", async () => {
  const { convertTemperature } = await import("../src/temperature");
  assert.equal(convertTemperature(68, "F", "C"), 20);
  assert.equal(convertTemperature(90, "F", "C"), 32.2);
  assert.equal(convertTemperature(20, "C", "F"), 68);
  assert.equal(convertTemperature(68, "F", "F"), 68);
});
