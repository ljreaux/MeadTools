import { z } from "zod";
import { equipmentInputSchema } from "@meadtools/inventory-domain";
import { authenticatedRouteErrorResponseSchema } from "./brews";

export const equipmentBrewSummarySchema = z.object({
  id: z.string().uuid(), name: z.string().nullable(), recipe_name: z.string().nullable(),
});
export const equipmentItemSchema = z.object({
  ...equipmentInputSchema.shape,
  id: z.string().uuid(), brew: equipmentBrewSummarySchema.nullable(),
}).refine((equipment) => equipment.type === "vessel" || equipment.capacity === null, {
  path: ["capacity"], message: "Only vessels have a capacity",
});
export const equipmentOverviewResponseSchema = z.object({
  can_manage: z.boolean(), equipment: z.array(equipmentItemSchema), brews: z.array(equipmentBrewSummarySchema),
});
export const createEquipmentRequestBodySchema = z.object({
  operation_id: z.string().uuid(), equipment: equipmentInputSchema,
}).strict();
export const updateEquipmentRequestBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), operation_id: z.string().uuid(), equipment: equipmentInputSchema }).strict(),
  z.object({ action: z.literal("assign"), operation_id: z.string().uuid(), brew_id: z.string().uuid().nullable(),
    expected_brew_id: z.string().uuid().nullable(), reassign: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal("archive"), operation_id: z.string().uuid() }).strict(),
]);
export const equipmentMutationResponseSchema = z.object({ equipment: equipmentItemSchema });
export const equipmentErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum(["NOT_FOUND", "PREMIUM_REQUIRED", "OPERATION_CONFLICT", "VESSEL_OCCUPIED",
    "BREW_COMPLETE", "NOT_A_VESSEL", "ASSIGNMENT_CHANGED", "INVALID_INVENTORY_REQUEST"]),
});
export const equipmentPathParamsSchema = z.object({ equipment_id: z.string().uuid() });
export const equipmentNotFoundErrorResponseSchema = z.union([equipmentErrorResponseSchema, authenticatedRouteErrorResponseSchema]);
export const equipmentUnexpectedErrorResponseSchema = z.object({ error: z.enum(["Equipment request failed", "Server misconfiguration"]) });
