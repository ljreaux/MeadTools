import assert from "node:assert/strict";
import test from "node:test";
import { loggedYeastAmountG } from "../src/yeast";

test("logged yeast weight accepts grams and legacy entries without units", () => {
  assert.equal(loggedYeastAmountG({ amount: 5, unit: "g" }), 5);
  assert.equal(loggedYeastAmountG({ amount: 2.5, unit: null }), 2.5);
  assert.equal(loggedYeastAmountG({ amount: 0, unit: "g" }), 0);
  assert.equal(loggedYeastAmountG({ amount: 0.5, unit: "kg" }), 500);
  assert.equal(loggedYeastAmountG({ amount: 500, unit: "mg" }), 0.5);
});

test("packet counts and unknown weights cannot become grams for nutrients or Go-Ferm", () => {
  for (const unit of ["units", "packets", "mL", "unknown"]) {
    assert.equal(loggedYeastAmountG({ amount: 0.5, unit }), null);
  }
  for (const amount of [null, NaN, Infinity, -1]) {
    assert.equal(loggedYeastAmountG({ amount, unit: "g" }), null);
  }
  assert.equal(loggedYeastAmountG(null), null);
});

test("packet guidance uses the supplied weight and follows corrected counts", () => {
  const packet = { amount: 0.5, unit: "units", meta: { packetWeightG: 5 } };
  assert.equal(loggedYeastAmountG(packet), 2.5);
  assert.equal(loggedYeastAmountG({ ...packet, amount: 0.25 }), 1.25);
  assert.equal(loggedYeastAmountG({ ...packet, meta: { packetWeightG: 10 } }), 5);
  for (const packetWeightG of [0, -5, NaN, Infinity, "5", undefined]) {
    assert.equal(loggedYeastAmountG({ ...packet, meta: { packetWeightG } }), null);
  }
});
