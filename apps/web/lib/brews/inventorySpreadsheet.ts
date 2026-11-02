import { loadTranslationResource } from "@meadtools/i18n/resources";
import { z } from "zod";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { unzipSync, strFromU8 } from "fflate";
import { parse } from "csv-parse/sync";
import {
  FILE_BYTE_LIMIT,
  SHEET_ROW_LIMIT,
  SHEET_COLUMN_LIMIT,
  transferHeaders,
  safeCsvCell,
  nutrientCatalog,
  stabilizerCatalog,
  quantityUnitSchema,
} from "@meadtools/inventory-domain";
import type { InventoryStockItem } from "@meadtools/api-contract/contracts";

export class InventoryFileError extends Error {
  constructor(
    readonly code:
      "INVALID_IMPORT_FILE" | "IMPORT_LIMIT" = "INVALID_IMPORT_FILE",
  ) {
    super(code);
  }
}
export type InventorySheet = { name: string; rows: string[][] };
function checkedSheets(sheets: InventorySheet[]): InventorySheet[] {
  if (!sheets.length || sheets.length > 12)
    throw new InventoryFileError("IMPORT_LIMIT");
  for (const sheet of sheets) {
    if (
      sheet.rows.length > SHEET_ROW_LIMIT ||
      sheet.rows.some(
        (row) =>
          row.length > SHEET_COLUMN_LIMIT ||
          row.some((cell) => cell.length > 5000),
      )
    )
      throw new InventoryFileError("IMPORT_LIMIT");
  }
  return sheets;
}
/** Inspect ZIP metadata before allocating expanded workbook contents or invoking XML parsing. */
function validateWorkbook(bytes: Uint8Array) {
  let expanded = 0;
  const names = new Set<string>();
  const files = unzipSync(bytes, {
    filter(file) {
      if (
        names.has(file.name) ||
        file.name.includes("..") ||
        file.name.includes("\\")
      )
        throw new InventoryFileError();
      names.add(file.name);
      expanded += file.originalSize;
      if (names.size > 200 || expanded > 20 * 1024 * 1024)
        throw new InventoryFileError("IMPORT_LIMIT");
      if (
        /(?:vbaProject|externalLinks|embeddings|connections|activeX)/i.test(
          file.name,
        )
      )
        throw new InventoryFileError();
      return /\.(?:xml|rels)$/i.test(file.name);
    },
  });
  if (!files["xl/workbook.xml"]) throw new InventoryFileError();
  for (const [name, bytes] of Object.entries(files)) {
    const xml = strFromU8(bytes);
    if (
      /<!DOCTYPE|<!ENTITY/i.test(xml) ||
      (name.endsWith(".rels") && /TargetMode\s*=\s*["']External/i.test(xml)) ||
      (name === "[Content_Types].xml" && /macroEnabled/i.test(xml))
    )
      throw new InventoryFileError();
    if (!/^xl\/worksheets\/.*\.xml$/.test(name)) continue;
    if (/<(?:\w+:)?f(?:\s|\/|>)|\bt\s*=\s*["']e["']/i.test(xml))
      throw new InventoryFileError();
    if (
      Array.from(xml.matchAll(/<(?:\w+:)?row(?:\s|>)/g)).length >
      SHEET_ROW_LIMIT
    )
      throw new InventoryFileError("IMPORT_LIMIT");
    for (const row of xml.matchAll(/\br\s*=\s*["'](\d+)["']/g))
      if (Number(row[1]) > SHEET_ROW_LIMIT)
        throw new InventoryFileError("IMPORT_LIMIT");
    let count = 0;
    for (const cell of xml.matchAll(/\br\s*=\s*["']([A-Z]+)(\d+)["']/g)) {
      const column = Array.from(cell[1]).reduce(
        (sum, char) => sum * 26 + char.charCodeAt(0) - 64,
        0,
      );
      if (
        column > SHEET_COLUMN_LIMIT ||
        Number(cell[2]) > SHEET_ROW_LIMIT ||
        ++count > SHEET_ROW_LIMIT * SHEET_COLUMN_LIMIT
      )
        throw new InventoryFileError("IMPORT_LIMIT");
    }
    // Dimensions can be sparse or forged; prevent the reader expanding giant empty ranges.
    for (const dimension of xml.matchAll(
      /\bref\s*=\s*["'](?:[A-Z]+\d+:)?([A-Z]+)(\d+)["']/g,
    )) {
      const column = Array.from(dimension[1]).reduce(
        (sum, char) => sum * 26 + char.charCodeAt(0) - 64,
        0,
      );
      if (column > SHEET_COLUMN_LIMIT || Number(dimension[2]) > SHEET_ROW_LIMIT)
        throw new InventoryFileError("IMPORT_LIMIT");
    }
  }
}
function detectCsvDelimiter(text: string): "," | ";" | "\t" {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < Math.min(text.length, 65536); i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === "," || char === ";" || char === "\t") counts[char]++;
    if (char === "\n" || char === "\r") {
      if (Object.values(counts).some(Boolean)) break;
    }
  }
  return ([",", ";", "\t"] as const).reduce(
    (best, delimiter) => (counts[delimiter] > counts[best] ? delimiter : best),
    ",",
  );
}

export async function inspectInventoryFile(
  filename: string,
  bytes: Uint8Array,
  delimiter: "auto" | "," | ";" | "\t" = "auto",
): Promise<InventorySheet[]> {
  if (bytes.length > FILE_BYTE_LIMIT)
    throw new InventoryFileError("IMPORT_LIMIT");
  try {
    if (/\.csv$/i.test(filename)) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const rows: string[][] = parse(text, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: false,
        max_record_size: 250_000,
        to: SHEET_ROW_LIMIT + 1,
        delimiter: delimiter === "auto" ? detectCsvDelimiter(text) : delimiter,
      });
      const header = rows.find(
        (row) => JSON.stringify(row) === JSON.stringify(transferHeaders),
      );
      if (header) {
        const index = rows.indexOf(header);
        for (const row of rows.slice(index + 1))
          for (let i = 0; i < row.length; i++)
            if (row[i].startsWith("'")) row[i] = row[i].slice(1);
      }
      return checkedSheets([{ name: "CSV", rows }]);
    }
    if (!/\.xlsx$/i.test(filename)) throw new InventoryFileError();
    validateWorkbook(bytes);
    const sheets = await readXlsxFile(Buffer.from(bytes), { trim: false });
    return checkedSheets(
      sheets.map((sheet) => ({
        name: sheet.sheet,
        rows: sheet.data.map((row) =>
          row.map((cell) =>
            cell instanceof Date
              ? cell.toISOString()
              : cell == null
                ? ""
                : String(cell),
          ),
        ),
      })),
    );
  } catch (error) {
    if (error instanceof InventoryFileError) throw error;
    throw new InventoryFileError();
  }
}
export async function exportInventoryFile(
  stocks: InventoryStockItem[],
  format: "xlsx" | "csv",
  template: boolean,
  catalog: ReadonlyMap<string, string> = new Map(),
) {
  const rows = template
    ? []
    : stocks.map((stock) => [
        stock.name,
        stock.category,
        stock.quantity.value,
        stock.quantity.unit,
        stock.notes ?? "",
        stock.catalogReference?.catalog ?? "",
        stock.catalogReference?.id ?? "",
        stock.catalogReference
          ? (catalog.get(
              `${stock.catalogReference.catalog}:${stock.catalogReference.id}`,
            ) ?? "")
          : "",
        stock.id,
      ]);
  const table = [transferHeaders, ...rows];
  if (format === "csv")
    return {
      filename: template
        ? "meadtools-inventory-template.csv"
        : "meadtools-inventory.csv",
      media_type: "text/csv;charset=utf-8",
      content: Buffer.from(
        "\uFEFF" +
          table
            .map((row) =>
              row.map((cell) => safeCsvCell(String(cell))).join(","),
            )
            .join("\r\n"),
        "utf8",
      ).toString("base64"),
    };
  const data: SheetData = table.map((row, index) =>
    row.map((cell) => ({
      value: cell,
      type: typeof cell === "number" ? Number : String,
      ...(index === 0
        ? { fontWeight: "bold" as const, backgroundColor: "#E8E8E8" }
        : {}),
    })),
  );
  const buffer = await writeXlsxFile([
    {
      sheet: "Inventory",
      data,
      stickyRowsCount: 1,
      columns: [
        { width: 30 },
        { width: 16 },
        { width: 16 },
        { width: 12 },
        { width: 50 },
        { width: 18 },
        { width: 38 },
        { width: 32 },
        { width: 38 },
      ],
    },
    {
      sheet: "Instructions",
      data: z
        .object({
          inventory: z.object({
            transfer: z.object({
              workbookInstructions: z.array(z.array(z.string())),
            }),
          }),
        })
        .parse(await loadTranslationResource("en", "default")).inventory
        .transfer.workbookInstructions,
    },
    {
      sheet: "Reference",
      data: [
        ["Catalog type", "Catalog ID", "Catalog name"],
        ...nutrientCatalog.map((item) => ["nutrient", item.id, item.name]),
        ...stabilizerCatalog.map((item) => ["additive", item.id, item.name]),
        [],
        ["Units", ...quantityUnitSchema.options],
      ],
    },
  ]).toBuffer();
  return {
    filename: template
      ? "meadtools-inventory-template.xlsx"
      : "meadtools-inventory.xlsx",
    media_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: buffer.toString("base64"),
  };
}
