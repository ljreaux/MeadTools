import { z } from "zod";
import {
  stockTransferImportSchema,
  SHEET_COLUMN_LIMIT,
  SHEET_ROW_LIMIT,
  stockInputSchema,
  quantitySchema,
  packagingQuantitySchema,
  finishedMeadDetailsSchema,
  finishedMeadInputSchema,
  bottleCountSchema,
  bottleDisplaySizeSchema,
  bottleDisplayMatches,
  bottleSizeLitersSchema,
} from "@meadtools/inventory-domain";
import {
  authenticatedRouteErrorResponseSchema,
  brewValidationErrorResponseSchema,
  brewSnapshotUpdateErrorResponseSchema,
  brewInventoryErrorResponseSchema,
} from "./brews";

export const inventoryStorageSourceSchema = z.union([
  z.literal("unlocated"), z.object({ location_id: z.string().uuid(), position: z.string().max(200) }).strict(),
]);

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
        storage_source: inventoryStorageSourceSchema.optional(),
      })
      .strict().refine((value) => value.storage_source === undefined || value.action === "manual_use", { message: "A storage source is only used for manual use" }),
    z
      .object({
        action: z.literal("reconcile"),
        operation_id: z.string().uuid(),
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        quantity: quantitySchema,
        note: z.string().max(5000).nullable().default(null),
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
export const inventoryStockReconciliationSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  uses: z.array(
    z.object({
      id: z.string().uuid(),
      entry_id: z.string().uuid(),
      brew_id: z.string().uuid(),
      line_key: z.string(),
      name: z.string(),
      previous: quantitySchema,
      current: quantitySchema.nullable(),
    }),
  ),
});
export const inventoryStockHistoryResponseSchema = z.object({
  reconciliation: inventoryStockReconciliationSchema.optional(),
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

export const finishedMeadBottleSchema = z.object({
  id: z.string().uuid(),
  size_liters: bottleSizeLitersSchema,
  display_size: bottleDisplaySizeSchema.nullable().default(null),
  quantity: bottleCountSchema,
});
export const finishedMeadItemSchema = z.object({
  ...finishedMeadDetailsSchema.shape,
  id: z.string().uuid(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  bottles: z.array(finishedMeadBottleSchema),
});
export const finishedMeadOverviewResponseSchema = z.object({
  can_manage: z.boolean(),
  meads: z.array(finishedMeadItemSchema),
});
export const createFinishedMeadRequestBodySchema = z.object({
  operation_id: z.string().uuid(),
  mead: finishedMeadInputSchema,
}).strict();
export const finishedMeadPathParamsSchema = z.object({ mead_id: z.string().uuid() });
export const finishedMeadMutationResponseSchema = z.object({ mead_id: z.string().uuid() });
const finishedMeadChangeBase = z.object({
  operation_id: z.string().uuid(),
  expected_revision: finishedMeadItemSchema.shape.revision,
});
export const updateFinishedMeadRequestBodySchema = z.discriminatedUnion("action", [
  finishedMeadChangeBase.extend({ action: z.literal("details"), ...finishedMeadDetailsSchema.shape }).strict(),
  finishedMeadChangeBase.extend({
    action: z.enum(["receipt", "manual_use", "correction"]),
    size_liters: bottleSizeLitersSchema,
    display_size: bottleDisplaySizeSchema.optional(),
    quantity: bottleCountSchema,
    note: z.string().max(5000).nullable().default(null),
    storage_source: inventoryStorageSourceSchema.optional(),
  }).strict().refine((value) => value.display_size === undefined ||
    (value.action === "receipt" && bottleDisplayMatches(value.size_liters, value.display_size)), {
    path: ["display_size"], message: "Bottle size is supplied only for a matching receipt",
  }).refine((value) => value.action === "correction" || value.quantity > 0, {
    path: ["quantity"], message: "Enter a positive bottle count",
  }).refine((value) => value.storage_source === undefined || value.action === "manual_use", { message: "A storage source is only used for manual use" }),
  finishedMeadChangeBase.extend({ action: z.literal("archive") }).strict(),
]);
export const finishedMeadHistoryResponseSchema = z.object({
  mead: finishedMeadItemSchema,
  adjustments: z.array(z.object({
    id: z.string().uuid(),
    kind: z.string(),
    source: z.object({name:z.string(),brew_id:z.string().uuid(),entry_id:z.string().uuid(),removed:z.boolean()}).nullable().default(null),
    size_liters: bottleSizeLitersSchema,
    display_size: bottleDisplaySizeSchema.nullable().default(null),
    delta: z.number().int(),
    balance_after: bottleCountSchema,
    note: z.string().nullable(),
    created_at: z.string().datetime(),
  })),
  has_more: z.boolean(),
});

export const inventoryLabelSchema = z.object({ id: z.string().uuid(), name: z.string(), version: z.number().int() });
export const inventoryLocationSchema = inventoryLabelSchema.extend({ parent_id: z.string().uuid().nullable(), path: z.string() });
export const inventoryAllocationSchema = z.object({
  location_id: z.string().uuid(), position: z.string().trim().max(200).default(""), quantity: quantitySchema.shape.value,
}).strict();
export const inventoryOrganizedStockSchema = z.object({
  id: z.string().uuid(), name: z.string(), mead_id: z.string().uuid().nullable(),
  bottle_size_liters: z.number().nullable(), display_size: bottleDisplaySizeSchema.nullable().default(null), quantity: quantitySchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/), allocations: z.array(inventoryAllocationSchema),
});
export const acknowledgeBottlingChangeRequestBodySchema = z.object({operation_id:z.string().uuid(),expected_revision:z.string().regex(/^[a-f0-9]{64}$/),confirmed_on_hand:z.literal(true)}).strict();
export const inventoryBottlingPathParamsSchema = z.object({bottling_id:z.string().uuid()});
export const inventoryOrganizationResponseSchema = z.object({
  bottling_changes: z.array(z.object({id:z.string().uuid(),brew_id:z.string().uuid(),source_name:z.string(),revision:z.string(),stock_ids:z.array(z.string().uuid()),source_missing:z.boolean()})).default([]),
  can_manage: z.boolean(), labels: z.array(inventoryLabelSchema), locations: z.array(inventoryLocationSchema),
  stock: z.array(inventoryOrganizedStockSchema),
  assignments: z.array(z.object({ kind: z.enum(["stock", "mead"]), id: z.string().uuid(), label_ids: z.array(z.string().uuid()) })),
});
const organizationOperationSchema = z.object({ operation_id: z.string().uuid() });
export const updateInventoryOrganizationRequestBodySchema = z.discriminatedUnion("action", [
  organizationOperationSchema.extend({ action: z.literal("create_label"), name: z.string().trim().min(1).max(100) }).strict(),
  organizationOperationSchema.extend({ action: z.literal("create_location"), name: z.string().trim().min(1).max(100), parent_id: z.string().uuid().nullable() }).strict(),
  organizationOperationSchema.extend({ action: z.literal("edit_label"), id: z.string().uuid(), expected_version: z.number().int(), name: z.string().trim().min(1).max(100) }).strict(),
  organizationOperationSchema.extend({ action: z.literal("edit_location"), id: z.string().uuid(), expected_version: z.number().int(), name: z.string().trim().min(1).max(100), parent_id: z.string().uuid().nullable() }).strict(),
  organizationOperationSchema.extend({ action: z.enum(["archive_label", "archive_location"]), id: z.string().uuid(), expected_version: z.number().int() }).strict(),
  organizationOperationSchema.extend({ action: z.literal("assign_labels"), kind: z.enum(["stock", "mead"]), id: z.string().uuid(), label_ids: z.array(z.string().uuid()).max(50), expected_label_ids: z.array(z.string().uuid()).max(50) }).strict(),
]);
export const inventoryOrganizationMutationResponseSchema = z.object({ id: z.string().uuid() });
export const updateInventoryStorageRequestBodySchema = z.object({
  operation_id: z.string().uuid(), expected_revision: z.string().regex(/^[a-f0-9]{64}$/),
  allocations: z.array(inventoryAllocationSchema).max(100),
}).strict().refine((value) => new Set(value.allocations.map((row) => JSON.stringify([row.location_id, row.position]))).size === value.allocations.length, { message: "Duplicate storage position" });
export const inventoryStorageHistoryResponseSchema = z.object({
  changes: z.array(z.object({ id: z.string().uuid(), operation_id: z.string().uuid(), location_path: z.string(), position: z.string(),
    delta: z.number(), balance_after: z.number(), unit: quantitySchema.shape.unit, reason: z.string(), created_at: z.string().datetime() })),
  has_more: z.boolean(),
});

/** Private brew-tracker context. Unavailable premium access returns no stock links or equipment history. */
export const brewBottlingContextSchema = z.object({
  entry_id: z.string().uuid(), revision: z.string(), reconciliation_required: z.boolean(), source_name: z.string(),
  outputs: z.array(z.object({row_id:z.string().uuid(),stock_id:z.string().uuid(),mead_id:z.string().uuid(),name:z.string(),quantity:z.number().int(),size_liters:z.number(),display_size:bottleDisplaySizeSchema.nullable().default(null)})),
});
export const brewInventoryContextResponseSchema = z.object({
  bottlings: z.array(brewBottlingContextSchema).default([]),
  brew_name: z.string().nullable().default(null),
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
