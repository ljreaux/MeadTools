import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { inventoryTransferRequestBodySchema } from "@meadtools/api-contract/inventory";
import {
  createInventoryService,
  InventoryWriteError,
  InventoryImportRowError,
} from "@/lib/db/inventory";
import { createInventoryAccountReader } from "@/lib/db/inventory-account";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import {
  InventoryError,
  nutrientCatalog,
  stabilizerCatalog,
} from "@meadtools/inventory-domain";
import {
  InventoryFileError,
  inspectInventoryFile,
  exportInventoryFile,
} from "@/lib/brews/inventorySpreadsheet";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import prisma from "@/lib/prisma";
const reader = createInventoryAccountReader();
const service = createInventoryService();
export const runtime = "nodejs";
async function boundedBody(req: NextRequest) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = req.body?.getReader();
  if (!stream) return null;
  try {
    for (;;) {
      const item = await stream.read();
      if (item.done) break;
      size += item.value.length;
      if (size > 8 * 1024 * 1024) {
        await stream.cancel();
        throw new InventoryFileError("IMPORT_LIMIT");
      }
      chunks.push(item.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof InventoryFileError) throw error;
    return null;
  } finally {
    stream.releaseLock();
  }
}
/**
 * Import or export inventory spreadsheets
 * @description Export and blank templates remain available to active owners after premium expiry. Inspect and import require premium. Reviewed imports are atomic and replay-safe; update mode uses owned stock IDs and expected snapshots. File content is base64 encoded. Supports XLSX and CSV with bounded file expansion and row limits.
 * @body InventoryTransferRequestBody
 * @response 200:InventoryTransferResponse
 * @responseSet none
 * @add 400:InventoryTransferErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:InventoryStockErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 409:InventoryStockErrorResponse
 * @add 413:InventoryTransferErrorResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const input = inventoryTransferRequestBodySchema.parse(
      await boundedBody(req),
    );
    const status = await getPremiumAccessStatus(user);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    if (input.action !== "export" && !status.premiumEnabled)
      throw new InventoryWriteError("PREMIUM_REQUIRED");
    let body;
    if (input.action === "inspect") {
      if (
        input.content.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(input.content) ||
        Buffer.from(input.content, "base64").toString("base64") !==
          input.content
      )
        throw new InventoryFileError();
      body = {
        kind: "sheets",
        sheets: await inspectInventoryFile(
          input.filename,
          Buffer.from(input.content, "base64"),
          input.delimiter,
        ),
      };
    } else if (input.action === "import")
      body = { kind: "imported", ...(await service.importStock(user, input)) };
    else {
      const [overview, ingredients, yeasts, additives] = await Promise.all([
        reader.overview(user),
        prisma.ingredients.findMany({ select: { id: true, name: true } }),
        prisma.yeasts.findMany({
          select: { id: true, name: true, brand: true },
        }),
        prisma.additives.findMany({ select: { id: true, name: true } }),
      ]);
      const catalog = new Map<string, string>([
        ...ingredients.map(
          (item) => [`ingredient:${item.id}`, item.name] as const,
        ),
        ...yeasts.map(
          (item) => [`yeast:${item.id}`, `${item.brand} ${item.name}`] as const,
        ),
        ...additives.map((item) => [`additive:${item.id}`, item.name] as const),
        ...nutrientCatalog.map(
          (item) => [`nutrient:${item.id}`, item.name] as const,
        ),
        ...stabilizerCatalog.map(
          (item) => [`additive:${item.id}`, item.name] as const,
        ),
      ]);
      body = {
        kind: "file",
        ...(await exportInventoryFile(
          overview.stock,
          input.format,
          input.template,
          catalog,
        )),
      };
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof InventoryImportRowError) {
      const response = inventoryRouteError(error.error);
      if (response.status >= 500) return response;
      return NextResponse.json(
        { ...(await response.json()), row_number: error.rowNumber },
        { status: response.status },
      );
    }
    if (error instanceof InventoryFileError)
      return NextResponse.json(
        {
          error:
            error.code === "IMPORT_LIMIT"
              ? "Spreadsheet exceeds import limits"
              : "This file cannot be read. Use an XLSX or UTF-8 CSV with literal values, without formulas, macros or external workbook links.",
          code: error.code,
        },
        { status: error.code === "IMPORT_LIMIT" ? 413 : 400 },
      );
    return inventoryRouteError(error);
  }
}
