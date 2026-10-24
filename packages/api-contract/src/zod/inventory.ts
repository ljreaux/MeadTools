import { z } from "zod";
import { stockInputSchema, quantitySchema, packagingQuantitySchema } from "@meadtools/inventory-domain";
import { authenticatedRouteErrorResponseSchema, brewInventoryErrorResponseSchema } from "./brews";

export const inventoryStockItemSchema = z.object({
  ...stockInputSchema.shape,
  id: z.string().uuid(),
  reconciliation_required: z.boolean(),
}).refine((stock) => stock.category !== "packaging" || packagingQuantitySchema.safeParse(stock.quantity).success, {
  path: ["quantity"], message: "Packaging is recorded in whole units",
});
export const inventoryOverviewResponseSchema = z.object({
  can_manage: z.boolean(), stock: z.array(inventoryStockItemSchema),
});
export const createInventoryStockRequestBodySchema = z.object({
  operation_id: z.string().uuid(), stock: stockInputSchema,
}).strict();
export const updateInventoryStockRequestBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["receipt", "manual_use", "correction"]), operation_id: z.string().uuid(),
    quantity: quantitySchema, note: z.string().max(5000).nullable().default(null),
    expected_balance: quantitySchema,
  }).strict(),
  z.object({ action: z.literal("archive"), operation_id: z.string().uuid() }).strict(),
]);
export const inventoryStockMutationResponseSchema = z.object({
  stockId: z.string().uuid(), balance: quantitySchema,
});
export const inventoryStockPathParamsSchema = z.object({ stock_id: z.string().uuid() });
export const inventoryStockHistoryResponseSchema = z.object({
  stock: inventoryStockItemSchema,
  adjustments: z.array(z.object({
    id: z.string().uuid(), kind: z.string(), delta: z.number(), balance_after: quantitySchema,
    note: z.string().nullable(), created_at: z.string().datetime(),
  })),
  has_more: z.boolean(),
});
export const inventoryStockErrorResponseSchema = brewInventoryErrorResponseSchema;
export const inventoryStockNotFoundResponseSchema = z.union([inventoryStockErrorResponseSchema, authenticatedRouteErrorResponseSchema]);
export const inventoryStockUnexpectedErrorResponseSchema = z.object({ error: z.enum(["Inventory request failed", "Server misconfiguration"]) });
