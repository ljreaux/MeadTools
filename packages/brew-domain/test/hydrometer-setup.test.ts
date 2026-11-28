import assert from "node:assert/strict";
import test from "node:test";
import { hydrometerSetupAddresses, parseHydrometerCoefficients } from "../src/hydrometer-setup";

test("calibration preserves cubic order, signed decimals and scientific notation", () => {
  assert.deepEqual(
    parseHydrometerCoefficients(["1.2e-7", "-0,003", "+.25", " 1 "]),
    [1.2e-7, -0.003, 0.25, 1]
  );
  assert.deepEqual(parseHydrometerCoefficients(["0", "0", "0", "0"]), [0, 0, 0, 0]);
});
test("calibration rejects incomplete input and nonfinite values instead of silently coercing them", () => {
  for (const invalid of [
    "",
    " ",
    "-",
    "1.",
    "1e",
    "1e-",
    "NaN",
    "Infinity",
    "1e999",
    "1 2",
    "1.2.3"
  ]) {
    assert.equal(parseHydrometerCoefficients([invalid, "0", "0", "1"]), null, invalid);
  }
  assert.equal(parseHydrometerCoefficients(["0", "1"]), null);
});
test("setup addresses omit private URLs until reveal and encode the exact token", () => {
  assert.deepEqual(hydrometerSetupAddresses("https://meadtools.test/"), {
    server: "https://meadtools.test",
    iSpindelPath: "/api/ispindel",
    tilt: null,
    raptCloud: null
  });
  const result = hydrometerSetupAddresses("https://meadtools.test/", "test token&only");
  assert.equal(new URL(result.tilt!).searchParams.get("token"), "test token&only");
  assert.equal(new URL(result.raptCloud!).pathname, "/api/hydrometer/rapt-pill/cloud");
  for (const bad of [
    "javascript:alert(1)",
    "https://test:secret@meadtools.test",
    "https://meadtools.test/?token=test"
  ])
    assert.throws(() => hydrometerSetupAddresses(bad));
});
