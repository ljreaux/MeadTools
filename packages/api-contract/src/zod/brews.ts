import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";

export const brewStageResponseSchema =
  z.enum([
    "PLANNED", "PRIMARY", "SECONDARY", "BULK_AGE", "STABILIZED",
    "BACKSWEETENED", "PACKAGED", "COMPLETE"
  ]);
export const brewEntryTypeResponseSchema =
  z.enum([
    "NOTE", "GRAVITY", "VOLUME", "TEMPERATURE", "PH", "ADDITION",
    "NUTRIENT", "RACKING", "STABILIZATION", "BACKSWEETENING",
    "PACKAGING", "TASTING", "STAGE_CHANGE", "ISSUE"
  ]);
export const temperatureUnitResponseSchema =
  z.enum(["F", "C", "K"]);
export const gravityUnitResponseSchema =
  z.enum(["SG", "BRIX"]);
const jsonObjectSchema = z.record(z.unknown());

export const brewPathParamsSchema =
  z.object({ brew_id: z.string() });
export const brewEntryPathParamsSchema =
  z.object({ brew_id: z.string(), entry_id: z.string() });

const brewListItemObjectSchema = z.object({
  id: z.string(), name: z.string().nullable(), start_date: z.string(),
  end_date: z.string().nullable(), stage: brewStageResponseSchema,
  batch_number: z.number().nullable(), current_volume_liters: z.number().nullable(),
  requested_email_alerts: z.boolean(), gravity_unit_preference: gravityUnitResponseSchema,
  public: z.boolean(), recipe_id: z.number().nullable(),
  recipe_name: z.string().nullable(), recipe_private: z.boolean().nullable(),
  entry_count: z.number(), latest_gravity: z.number().nullable()
});
export const brewListItemResponseSchema =
  brewListItemObjectSchema;
export const brewsResponseSchema =
  z.object({ brews: z.array(brewListItemResponseSchema) });
export const brewRecipeSnapshotResponseSchema =
  z.object({
    id: z.number(), name: z.string(), version: z.number(),
    dataV2: recipeDataV2Schema.nullable(), snapshottedAt: z.string()
  });
const brewEntryObjectSchema = z.object({
  id: z.string(), datetime: z.string(), type: brewEntryTypeResponseSchema,
  title: z.string().nullable(), note: z.string().nullable(),
  gravity: z.number().nullable(), temperature: z.number().nullable(),
  temp_units: temperatureUnitResponseSchema.nullable(),
  data: jsonObjectSchema.nullable(), user_id: z.number().nullable()
});
export const brewEntryResponseSchema =
  brewEntryObjectSchema;
export const brewEntryWithBrewIdResponseSchema =
  brewEntryObjectSchema.extend({ brew_id: z.string() });
export const brewEntriesByStageResponseSchema =
  z.object({
    stage: brewStageResponseSchema,
    entries: z.array(brewEntryResponseSchema)
  });
export const brewResponseSchema =
  brewListItemObjectSchema.omit({ requested_email_alerts: true }).extend({
    requested_email_alerts: z.boolean(),
    recipe_snapshot: brewRecipeSnapshotResponseSchema.nullable(),
    entries: z.array(brewEntryResponseSchema),
    entries_by_stage: z.array(brewEntriesByStageResponseSchema)
  });

export const createBrewRequestBodySchema =
  z.object({
    recipe_id: z.number(), name: z.string().nullable().optional(),
    current_volume_liters: z.number().nullable().optional()
  });
const brewMutationResponseObjectSchema = brewListItemObjectSchema
  .omit({ requested_email_alerts: true, entry_count: true })
  .extend({ requested_email_alerts: z.boolean().nullable(), entry_count: z.number() });
export const createBrewResponseSchema =
  z.object({ brew: brewMutationResponseObjectSchema });
export const updateBrewRequestBodySchema =
  z.object({
    name: z.string().nullable().optional(), stage: brewStageResponseSchema.optional(),
    current_volume_liters: z.number().nullable().optional(),
    requested_email_alerts: z.boolean().optional(),
    gravity_unit_preference: gravityUnitResponseSchema.optional(),
    public: z.boolean().optional(), end_date: z.string().nullable().optional()
  });
export const updateBrewResponseSchema =
  brewMutationResponseObjectSchema.omit({ entry_count: true }).nullable();

export const publicRecipeBrewsPathParamsSchema =
  z.object({ id: z.string() });
export const publicRecipeBrewPathParamsSchema =
  z.object({ id: z.string(), brew_id: z.string() });
export const publicBrewOwnerResponseSchema =
  z.object({ displayName: z.string() });
const publicBrewListItemObjectSchema = brewListItemObjectSchema
  .omit({ requested_email_alerts: true, recipe_private: true })
  .extend({ owner: publicBrewOwnerResponseSchema.nullable() });
export const publicBrewListItemResponseSchema =
  publicBrewListItemObjectSchema;
const publicBrewEntryObjectSchema = brewEntryObjectSchema.omit({ user_id: true });
export const publicBrewEntryResponseSchema =
  publicBrewEntryObjectSchema;
export const publicBrewEntriesByStageResponseSchema =
  z.object({
    stage: brewStageResponseSchema,
    entries: z.array(publicBrewEntryResponseSchema)
  });
export const publicBrewLogResponseSchema =
  z.object({
    datetime: z.string(), temperature: z.number(),
    temp_units: temperatureUnitResponseSchema, battery: z.number().nullable(),
    gravity: z.number(), calculated_gravity: z.number().nullable()
  });
export const publicBrewDetailResponseSchema =
  publicBrewListItemObjectSchema.extend({
    recipe_snapshot: brewRecipeSnapshotResponseSchema.nullable(),
    entries: z.array(publicBrewEntryResponseSchema),
    entries_by_stage: z.array(publicBrewEntriesByStageResponseSchema),
    logs: z.array(publicBrewLogResponseSchema)
  });
export const publicRecipeBrewsResponseSchema =
  z.object({ brews: z.array(publicBrewListItemResponseSchema) });
export const publicRecipeBrewResponseSchema =
  z.object({ brew: publicBrewDetailResponseSchema });
export const publicBrewValidationErrorResponseSchema =
  z.object({ error: z.enum(["Invalid recipe ID", "Missing brew_id"]) });
export const publicBrewNotFoundErrorResponseSchema =
  z.object({ error: z.literal("Brew not found") });
export const publicBrewFetchErrorResponseSchema =
  z.object({ error: z.enum(["Failed to fetch public brews", "Failed to fetch public brew"]) });

const brewEntryMutationObjectSchema = z.object({
  datetime: z.string().optional(), title: z.string().nullable().optional(),
  note: z.string().nullable().optional(), gravity: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
  temp_units: temperatureUnitResponseSchema.nullable().optional(),
  data: jsonObjectSchema.nullable().optional()
});
export const createBrewEntryRequestBodySchema =
  brewEntryMutationObjectSchema.extend({
    type: brewEntryTypeResponseSchema,
    stage_to: brewStageResponseSchema.optional(),
    client_entry_id: z.string().uuid().optional()
  });
export const createBrewEntryResponseSchema =
  z.object({ brew: brewResponseSchema });
export const brewEntryIdConflictErrorResponseSchema =
  z.object({ error: z.literal("Entry ID is already in use") });
export const updateBrewEntryRequestBodySchema =
  brewEntryMutationObjectSchema;
export const updateBrewEntryResponseSchema =
  z.object({ entry: brewEntryWithBrewIdResponseSchema.nullable() });
export const deleteBrewSuccessResponseSchema =
  z.object({ message: z.literal("Brew deleted successfully.") });
export const deleteBrewEntrySuccessResponseSchema =
  z.object({ message: z.literal("Entry deleted successfully.") });
export const attachDeviceToBrewRequestBodySchema =
  z.object({ device_id: z.string(), force: z.boolean().optional() });
export const attachDeviceToBrewResponseSchema =
  z.object({
    message: z.enum(["Device already attached", "Device attached"]),
    device_id: z.string(), brew_id: z.string()
  });
export const adoptLogsForBrewRequestBodySchema =
  z.object({
    device_id: z.string(), start_date: z.string().optional(),
    end_date: z.string().optional(), from_brew_id: z.string().nullable().optional()
  });
export const adoptLogsForBrewResponseSchema =
  z.object({
    message: z.literal("Logs adopted"), adopted_count: z.number(),
    brew_id: z.string(), device_id: z.string()
  });

const errorEnum = <T extends string>(values: [T, ...T[]]) =>
  z.object({ error: z.enum(values) });
export const authenticatedRouteErrorResponseSchema =
  errorEnum(["Authorization header missing", "Token missing", "Invalid token or unauthorized access", "Invalid or expired token", "User not found", "Server misconfiguration"]);
export const brewValidationErrorResponseSchema =
  errorEnum([
    "Invalid JSON body", "Missing recipe_id", "Missing brew_id",
    "Missing entry_id", "Invalid client_entry_id"
  ]);
export const brewFetchErrorResponseSchema =
  errorEnum(["Failed to fetch brews.", "Failed to fetch brew.", "Server misconfiguration"]);
export const brewCreateErrorResponseSchema =
  errorEnum(["Failed to create brew.", "Server misconfiguration"]);
export const brewUpdateErrorResponseSchema =
  errorEnum(["Failed to update brew.", "Server misconfiguration"]);
export const brewDeleteErrorResponseSchema =
  errorEnum(["Failed to delete brew.", "Server misconfiguration"]);
export const brewEntryCreateErrorResponseSchema =
  errorEnum(["Failed to create entry.", "Server misconfiguration"]);
export const brewEntryUpdateErrorResponseSchema =
  errorEnum(["Failed to update entry.", "Server misconfiguration"]);
export const brewEntryDeleteErrorResponseSchema =
  errorEnum(["Failed to delete entry.", "Server misconfiguration"]);
export const brewDeviceActionErrorResponseSchema =
  errorEnum(["Missing device_id", "Brew not found", "Device not found", "Device already attached to another brew", "Invalid start_date", "Invalid end_date", "Failed", "Server misconfiguration"]);
