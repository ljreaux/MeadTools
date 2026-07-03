import assert from "node:assert/strict";
import test from "node:test";
import {
  hydrometerDeviceResponseSchema,
  hydrometerIngestRequestBodySchema,
  tiltIngestRequestBodySchema,
  updateHydrometerLogRequestBodySchema
} from "../src/zod/hydrometers";

test("hydrometer schemas preserve device and ingestion payloads", () => {
  assert.equal(
    hydrometerDeviceResponseSchema.safeParse({
      id: "device",
      device_name: null,
      brew_id: null,
      recipe_id: null,
      coefficients: [0, 1, 2],
      brews: null
    }).success,
    true
  );
  assert.equal(
    hydrometerIngestRequestBodySchema.safeParse({
      token: "token",
      name: "iSpindel",
      temperature: 68,
      gravity: 1.05
    }).success,
    true
  );
});

test("hydrometer update and Tilt schemas retain mixed numeric inputs", () => {
  assert.equal(
    updateHydrometerLogRequestBodySchema.safeParse({
      temperature: "68",
      gravity: 1.05,
      temp_units: "F"
    }).success,
    true
  );
  assert.equal(
    tiltIngestRequestBodySchema.safeParse({
      Beer: "BLUE",
      Temp: "68",
      SG: 1.05,
      Color: "BLUE"
    }).success,
    true
  );
});

test("hydrometer schemas reject unsupported units and Tilt colors", () => {
  assert.equal(
    updateHydrometerLogRequestBodySchema.safeParse({ temp_units: "K" })
      .success,
    false
  );
  assert.equal(
    tiltIngestRequestBodySchema.safeParse({
      Beer: "test",
      Temp: 68,
      SG: 1.05,
      Color: "GREEN"
    }).success,
    false
  );
});
