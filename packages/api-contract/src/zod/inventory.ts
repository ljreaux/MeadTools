import { z } from "zod";
import {
  stockTransferImportSchema,
  SHEET_COLUMN_LIMIT,
  SHEET_ROW_LIMIT,
  stockInputSchema,
  quantitySchema,
  packagingQuantitySchema,
} from "@meadtools/inventory-domain";
import {
  authenticatedRouteErrorResponseSchema,
  brewValidationErrorResponseSchema,
  brewSnapshotUpdateErrorResponseSchema,
  brewInventoryErrorResponseSchema,
} from "./brews";

export const inventoryStockItemSchema = z
  .object({
    ...stockInputSchema.shape,
    id: z.string().uuid(),
    reconciliation_required: z.boolean(),
  })
  .refine(
    (stock) =>
      stock.category !== "packaging" ||
      packagingQuantitySchema.safeParse(stock.quantity).success,
    {
      path: ["quantity"],
      message: "Packaging is recorded in whole units",
    },
  );
export const inventoryOverviewResponseSchema = z.object({
  can_manage: z.boolean(),
  stock: z.array(inventoryStockItemSchema),
});
export const createInventoryStockRequestBodySchema = z
  .object({
    operation_id: z.string().uuid(),
    stock: stockInputSchema,
  })
  .strict();
export const updateInventoryStockRequestBodySchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("details"),
        operation_id: z.string().uuid(),
        name: stockInputSchema.shape.name,
        catalogReference: stockInputSchema.shape.catalogReference,
        notes: stockInputSchema.shape.notes,
      })
      .strict(),
    z
      .object({
        action: z.enum(["receipt", "manual_use", "correction"]),
        operation_id: z.string().uuid(),
        quantity: quantitySchema,
        note: z.string().max(5000).nullable().default(null),
        expected_balance: quantitySchema,
      })
      .strict(),
    z
      .object({ action: z.literal("archive"), operation_id: z.string().uuid() })
      .strict(),
  ],
);
export const inventoryStockMutationResponseSchema = z.object({
  stockId: z.string().uuid(),
  balance: quantitySchema,
});
export const inventoryStockPathParamsSchema = z.object({
  stock_id: z.string().uuid(),
});
export const inventoryStockHistoryResponseSchema = z.object({
  stock: inventoryStockItemSchema,
  adjustments: z.array(
    z.object({
      id: z.string().uuid(),
      kind: z.string(),
      delta: z.number(),
      balance_after: quantitySchema,
      note: z.string().nullable(),
      created_at: z.string().datetime(),
    }),
  ),
  has_more: z.boolean(),
});
export const inventoryStockErrorResponseSchema =
  brewInventoryErrorResponseSchema;
export const inventoryStockNotFoundResponseSchema = z.union([
  inventoryStockErrorResponseSchema,
  authenticatedRouteErrorResponseSchema,
]);
export const inventoryStockUnexpectedErrorResponseSchema = z.object({
  error: z.enum(["Inventory request failed", "Server misconfiguration"]),
});

/** Private brew-tracker context. Unavailable premium access returns no stock links or equipment history. */
export const brewInventoryContextResponseSchema = z.object({
  can_manage: z.boolean(),
  tracked_entry_ids: z.array(z.string().uuid()),
  usages: z.array(
    z.object({
      entry_id: z.string().uuid(),
      line_key: z.string(),
      line_name: z.string(),
      stock_id: z.string().uuid(),
      deducted: quantitySchema,
      stock: inventoryStockItemSchema,
      stock_archived: z.boolean(),
    }),
  ),
  vessel_events: z.array(
    z.object({
      id: z.string().uuid(),
      equipment_name: z.string(),
      quantity: z.number().int().min(1),
      action: z.enum(["assigned", "released"]),
      created_at: z.string().datetime(),
    }),
  ),
});
export const brewInventoryPathParamsSchema = z.object({
  brew_id: z.string().uuid(),
});

export const brewContainerErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum([
    "ASSIGNMENT_CHANGED",
    "VESSEL_OCCUPIED",
    "BREW_COMPLETE",
    "NOT_FOUND",
    "PREMIUM_REQUIRED",
    "OPERATION_CONFLICT",
    "INVALID_INVENTORY_REQUEST",
    "ENTRY_MISMATCH",
  ]),
});
export const brewMetadataInventoryErrorResponseSchema = z.union([
  brewSnapshotUpdateErrorResponseSchema,
  brewInventoryErrorResponseSchema,
  brewContainerErrorResponseSchema,
]);

export const brewMetadataValidationErrorResponseSchema = z.union([
  brewValidationErrorResponseSchema,
  brewMetadataInventoryErrorResponseSchema,
]);

export const inventoryTransferRequestBodySchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("inspect"),
        filename: z.string().min(1).max(255),
        content: z.string().min(1).max(7_000_000),
        delimiter: z.enum(["auto", ",", ";", "\t"]).default("auto"),
      })
      .strict(),
    z.object({ ...stockTransferImportSchema.shape }).strict(),
    z
      .object({
        action: z.literal("export"),
        format: z.enum(["xlsx", "csv"]),
        template: z.boolean().default(false),
      })
      .strict(),
  ],
);
export const inventoryTransferResponseSchema = z.union([
  z.object({
    kind: z.literal("sheets"),
    sheets: z
      .array(
        z.object({
          name: z.string().max(200),
          rows: z
            .array(z.array(z.string().max(5000)).max(SHEET_COLUMN_LIMIT))
            .max(SHEET_ROW_LIMIT),
        }),
      )
      .max(12),
  }),
  z.object({
    kind: z.literal("file"),
    filename: z.string(),
    media_type: z.string(),
    content: z.string(),
  }),
  z.object({
    kind: z.literal("imported"),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
  }),
]);
export const inventoryTransferErrorResponseSchema = z.union([
  inventoryStockErrorResponseSchema.extend({
    row_number: z.number().int().optional(),
  }),
  z.object({
    error: z.string(),
    code: z.enum(["INVALID_IMPORT_FILE", "IMPORT_LIMIT"]),
    row_number: z.number().int().optional(),
  }),
]);
