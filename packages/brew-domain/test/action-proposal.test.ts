import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrewActionProposal,
  describeBrewActionEntry,
} from "../src/action-proposal";

test("brew action proposals bind a validated entry to a trusted target", () => {
  const proposal = createBrewActionProposal(
    {
      brewId: "11111111-1111-4111-8111-111111111111",
      brewLabel: "Brew: Summer Traditional",
    },
    {
      type: "ADDITION",
      data: {
        kind: "OTHER",
        name: "Vanilla bean",
        amount: 1,
        unit: "units",
      },
    },
  );

  assert.deepEqual(proposal.target, {
    brewId: "11111111-1111-4111-8111-111111111111",
    brewLabel: "Brew: Summer Traditional",
  });
  assert.equal(proposal.kind, "create_brew_entry");
  assert.equal(proposal.version, 1);
  assert.equal(proposal.summary, "Log 1 units Vanilla bean as an addition.");
});

test("brew action descriptions stay readable for measurements and stage changes", () => {
  assert.equal(
    describeBrewActionEntry({
      type: "TEMPERATURE",
      temperature: 20,
      temp_units: "C",
    }),
    "Log a temperature reading of 20 °C.",
  );
  assert.equal(
    describeBrewActionEntry({ type: "STAGE_CHANGE", stage_to: "BULK_AGE" }),
    "Move this brew to bulk age.",
  );
});
