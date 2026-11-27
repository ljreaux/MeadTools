import assert from "node:assert/strict";
import test from "node:test";
import {
  hydrometerBrewName,
  linkableHydrometerDevices,
  linkHydrometerWithUnassignedLogs,
  searchHydrometerChoices
} from "../src/hydrometer-lifecycle";
test("a blank rename cannot fall through to the server's end-session branch", () => {
  assert.equal(hydrometerBrewName(" \t\n "), null);
  assert.equal(hydrometerBrewName("  Batch 12  "), "Batch 12");
});
test("device choices keep active assignments elsewhere out of a new attachment", () => {
  const available = { id: "free", brew_id: null };
  const here = { id: "here", brew_id: "target" };
  const elsewhere = { id: "elsewhere", brew_id: "other" };
  assert.deepEqual(linkableHydrometerDevices([available, here, elsewhere], "target"), [
    available,
    here
  ]);
});
test("choice search handles names and descriptions without changing source order", () => {
  const choices = [
    { id: "a", name: "Traditional", description: "Primary" },
    { id: "b", name: "Blueberry", description: "Planned" }
  ];
  assert.deepEqual(searchHydrometerChoices(choices, ""), choices);
  assert.equal(searchHydrometerChoices(choices, "bluebery")[0].id, "b");
  assert.equal(searchHydrometerChoices(choices, "Primary")[0].id, "a");
  assert.equal(choices[0].id, "a");
});
test("attachment succeeds before unassigned-history import", async () => {
  const calls: string[] = [];
  const result = await linkHydrometerWithUnassignedLogs({
    attach: async () => {
      calls.push("attach");
    },
    importLogs: async () => {
      calls.push("import");
      return { adopted_count: 4 };
    }
  });
  assert.deepEqual(calls, ["attach", "import"]);
  assert.deepEqual(result, { linked: true, imported: true, adoptedCount: 4 });
});
test("an import failure reports the successful attachment instead of retrying or hiding it", async () => {
  let attachments = 0;
  const result = await linkHydrometerWithUnassignedLogs({
    attach: async () => {
      attachments++;
    },
    importLogs: async () => {
      throw new Error("Connection lost");
    }
  });
  assert.equal(attachments, 1);
  assert.deepEqual(result, { linked: true, imported: false, adoptedCount: null });
});
test("an attachment conflict does not start any log adoption", async () => {
  let imports = 0;
  await assert.rejects(
    linkHydrometerWithUnassignedLogs({
      attach: async () => {
        throw new Error("Already assigned");
      },
      importLogs: async () => {
        imports++;
        return { adopted_count: 0 };
      }
    })
  );
  assert.equal(imports, 0);
});
