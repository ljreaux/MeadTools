import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, unzipSync, strFromU8, strToU8 } from "fflate";
import {
  inspectInventoryFile,
  exportInventoryFile,
} from "./inventorySpreadsheet";
import { transferHeaders } from "@meadtools/inventory-domain";
const fixture = {
  id: "8cabf4e2-3e98-4d38-bc92-710ee044c6f7",
  name: "=Wildflower honey",
  category: "honey" as const,
  quantity: { value: 1.234567, unit: "kg" as const },
  notes: "Line 1\nLine 2 — café",
  catalogReference: { catalog: "ingredient" as const, id: "1" },
  reconciliation_required: false,
};
test("XLSX export/template round trips literal text, quantities, notes and IDs", async () => {
  const file = await exportInventoryFile(
    [fixture],
    "xlsx",
    false,
    new Map([["ingredient:1", "Honey"]]),
  );
  const sheets = await inspectInventoryFile(
    file.filename,
    Buffer.from(file.content, "base64"),
  );
  const data = sheets.find((sheet) => sheet.name === "Inventory")!.rows;
  assert.deepEqual(data[0], transferHeaders);
  assert.equal(data[1][0], fixture.name);
  assert.equal(data[1][2], "1.234567");
  assert.equal(data[1][4], fixture.notes);
  assert.equal(data[1][8], fixture.id);
  const template = await exportInventoryFile([fixture], "xlsx", true);
  assert.equal(
    (
      await inspectInventoryFile(
        template.filename,
        Buffer.from(template.content, "base64"),
      )
    )[0].rows.length,
    1,
  );
});
test("canonical CSV preserves literal formula-like names, apostrophes and multiline notes", async () => {
  for (const name of ["=SUM(A1)", "'abc", " +hello", 'a,"quoted"']) {
    const file = await exportInventoryFile(
      [{ ...fixture, name }],
      "csv",
      false,
    );
    const sheet = (
      await inspectInventoryFile(
        file.filename,
        Buffer.from(file.content, "base64"),
      )
    )[0];
    assert.equal(sheet.rows[1][0], name);
    assert.equal(sheet.rows[1][4], fixture.notes);
  }
});
test("CSV detects semicolon/tab delimiters, blank leading rows and BOM", async () => {
  for (const delimiter of [";", "\t"]) {
    const sheet = (
      await inspectInventoryFile(
        "stock.csv",
        Buffer.from(
          "\uFEFF\nName" + delimiter + "Quantity\nHoney" + delimiter + "1,5",
        ),
      )
    )[0];
    assert.ok(sheet.rows.some((row) => row[0] === "Honey" && row[1] === "1,5"));
  }
});
test("malformed and oversized input fails within defined limits", async () => {
  for (const name of ["data.xls", "data.txt", "data.xlsx"])
    await assert.rejects(
      inspectInventoryFile(name, Buffer.from("not a workbook")),
    );
  await assert.rejects(
    inspectInventoryFile("data.csv", new Uint8Array(5 * 1024 * 1024 + 1)),
    { code: "IMPORT_LIMIT" },
  );
  await assert.rejects(
    inspectInventoryFile(
      "data.csv",
      Buffer.from(
        Array.from({ length: 1102 }, () => ["a", "b"].join(",")).join("\n"),
      ),
    ),
    { code: "IMPORT_LIMIT" },
  );
});
test("formulas, sparse giant cells, macros and external links fail before parsing", async () => {
  const file = await exportInventoryFile([fixture], "xlsx", false);
  const original = unzipSync(Buffer.from(file.content, "base64"));
  const sheetName = Object.keys(original).find(
    (name) => name.startsWith("xl/worksheets/") && name.endsWith(".xml"),
  )!;
  for (const xml of [
    '<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>',
    '<worksheet><sheetData><row r="999999999"/></sheetData></worksheet>',
    '<worksheet><dimension ref="A1:ZZ999999"/></worksheet>',
    '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///tmp/test">]><worksheet/>',
  ])
    await assert.rejects(
      inspectInventoryFile(
        "stock.xlsx",
        zipSync({ ...original, [sheetName]: strToU8(xml) }),
      ),
    );
  await assert.rejects(
    inspectInventoryFile(
      "stock.xlsx",
      zipSync({ ...original, "xl/vbaProject.bin": strToU8("macro") }),
    ),
  );
  await assert.rejects(
    inspectInventoryFile(
      "stock.xlsx",
      zipSync({
        ...original,
        "xl/_rels/external.xml.rels": strToU8(
          '<Relationship TargetMode="External"/>',
        ),
      }),
    ),
  );
  assert.ok(!strFromU8(original[sheetName]).includes("<f>"));
});

test("ordinary notes mentioning workbook features stay literal data", async () => {
  const notes = "macroEnabled is just a note, not an enabled workbook feature";
  const file = await exportInventoryFile(
    [{ ...fixture, notes }],
    "xlsx",
    false,
  );
  const sheet = (
    await inspectInventoryFile(
      file.filename,
      Buffer.from(file.content, "base64"),
    )
  )[0];
  assert.equal(sheet.rows[1][4], notes);
});
