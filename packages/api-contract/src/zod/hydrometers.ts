import { z } from "zod";
import { brewStageResponseSchema, temperatureUnitResponseSchema } from "./brews";

const jsonObjectSchema = z.record(z.unknown());
const errorEnum = <T extends string>(values: [T, ...T[]]) =>
  z.object({ error: z.enum(values) });

export const hydrometerDevicePathParamsSchema =
  z.object({ device_id: z.string() });
export const hydrometerLogPathParamsSchema =
  z.object({ id: z.string() });
export const hydrometerLogsQueryParamsSchema =
  z.object({
    device_id: z.string(), start_date: z.string(),
    end_date: z.string().optional()
  });
export const hydrometerLogMutationQueryParamsSchema =
  z.object({ device_id: z.string() });
export const hydrometerLogMutationParamsSchema =
  z.object({ id: z.string(), device_id: z.string() });
export const hydrometerLogRangeDeleteQueryParamsSchema =
  z.object({
    device_id: z.string(), start_date: z.string(), end_date: z.string()
  });

export const hydrometerDeviceBrewResponseSchema =
  z.object({ id: z.string(), name: z.string().nullable() });
const hydrometerDeviceObjectSchema = z.object({
  id: z.string(), device_name: z.string().nullable(),
  brew_id: z.string().nullable(), recipe_id: z.number().nullable(),
  coefficients: z.array(z.number()),
  brews: hydrometerDeviceBrewResponseSchema.nullable().optional()
});
export const hydrometerDeviceResponseSchema =
  hydrometerDeviceObjectSchema;
export const hydrometerAccountResponseSchema =
  z.object({
    hydro_token: z.string().nullable(),
    devices: z.array(hydrometerDeviceResponseSchema)
  });
export const hydrometerTokenResponseSchema =
  z.object({ token: z.string() });

const hydrometerBrewObjectSchema = z.object({
  id: z.string(), start_date: z.string(), end_date: z.string().nullable(),
  user_id: z.number().nullable(), latest_gravity: z.number().nullable(),
  recipe_id: z.number().nullable(), name: z.string().nullable(),
  requested_email_alerts: z.boolean().nullable(),
  sb_alert_sent: z.boolean().nullable(), fg_alert_sent: z.boolean().nullable(),
  stage: brewStageResponseSchema, batch_number: z.number().nullable(),
  current_volume_liters: z.number().nullable(),
  recipe_snapshot: jsonObjectSchema.nullable()
});
export const hydrometerBrewResponseSchema =
  hydrometerBrewObjectSchema;
export const hydrometerBrewsResponseSchema =
  z.array(hydrometerBrewResponseSchema);
export const startHydrometerBrewRequestBodySchema =
  z.object({ device_id: z.string(), brew_name: z.string() });
export const hydrometerBrewDevicePairItemResponseSchema =
  z.union([hydrometerBrewResponseSchema, hydrometerDeviceResponseSchema]);
export const startHydrometerBrewResponseSchema =
  z.array(hydrometerBrewDevicePairItemResponseSchema);
export const updateHydrometerBrewRequestBodySchema =
  z.object({
    brew_id: z.string(), device_id: z.string().optional(),
    brew_name: z.string().nullable().optional()
  });
export const renameHydrometerBrewResponseSchema =
  hydrometerBrewResponseSchema;
export const endHydrometerBrewResponseSchema =
  z.array(hydrometerBrewDevicePairItemResponseSchema);
export const updateHydrometerBrewResponseSchema =
  z.union([hydrometerBrewResponseSchema, endHydrometerBrewResponseSchema]);
export const linkRecipeToHydrometerBrewRequestBodySchema =
  z.object({
    recipe_id: z.number().optional(),
    requested_email_alerts: z.boolean().optional()
  });
export const linkRecipeToHydrometerBrewResponseSchema =
  hydrometerBrewResponseSchema;
export const hydrometerBrewAlertResponseSchema =
  z.object({ message: z.string() });
export const updateHydrometerBrewRecipeOrAlertsResponseSchema =
  z.union([
    linkRecipeToHydrometerBrewResponseSchema,
    hydrometerBrewAlertResponseSchema
  ]);
export const deleteHydrometerBrewResponseSchema =
  z.object({ message: z.literal("Brew deleted successfully.") });
export const updateHydrometerDeviceRequestBodySchema =
  z.object({ coefficients: z.array(z.number()) });
export const deleteHydrometerDeviceResponseSchema =
  z.object({ message: z.string() });

const hydrometerLogObjectSchema = z.object({
  id: z.string(), datetime: z.string(), angle: z.number(),
  temperature: z.number(), temp_units: temperatureUnitResponseSchema,
  battery: z.number(), gravity: z.number(), interval: z.number(),
  calculated_gravity: z.number().nullable(), device_id: z.string().nullable(),
  brew_id: z.string().nullable()
});
export const hydrometerLogResponseSchema =
  hydrometerLogObjectSchema;
export const hydrometerLogsResponseSchema =
  z.array(hydrometerLogResponseSchema);
const numberOrStringSchema = z.union([z.number(), z.string()]);
export const updateHydrometerLogRequestBodySchema =
  z.object({
    angle: numberOrStringSchema.optional(),
    temperature: numberOrStringSchema.optional(),
    temp_units: z.enum(["F", "C"]).optional(),
    battery: numberOrStringSchema.optional(),
    gravity: numberOrStringSchema.optional(),
    interval: numberOrStringSchema.optional(),
    calculated_gravity: numberOrStringSchema.optional(),
    dateTime: z.string().optional()
  });
export const deleteHydrometerLogsInRangeResponseSchema =
  z.object({ message: z.string() });
const hydrometerIngestObjectSchema = z.object({
  token: z.string(), name: z.string(), angle: z.number().optional(),
  temperature: z.number(), temp_units: z.enum(["F", "C"]).optional(),
  battery: z.number().optional(), gravity: z.number(),
  interval: z.number().optional()
});
export const hydrometerIngestRequestBodySchema =
  hydrometerIngestObjectSchema;
export const raptPillCloudIngestRequestBodySchema =
  hydrometerIngestObjectSchema;
export const raptPillRegisterRequestBodySchema =
  z.object({ token: z.string(), name: z.string(), gravity: z.number() });
export const tiltColorSchema = z.enum([
  "BLUE", "BLACK", "RED", "ORANGE", "YELLOW", "PURPLE", "PINK"
]);
export const tiltIngestQueryParamsSchema =
  z.object({ token: z.string() });
export const tiltIngestRequestBodySchema =
  z.object({
    Beer: z.string(), Temp: numberOrStringSchema, SG: numberOrStringSchema,
    Color: tiltColorSchema, Comment: z.string().optional(),
    Timepoint: numberOrStringSchema.optional()
  });

export const hydrometerAuthErrorResponseSchema =
  errorEnum(["Missing token", "Invalid token"]);
export const hydrometerAccountErrorResponseSchema =
  errorEnum(["Failed to fetch hydro_token", "Failed to create hydro_token", "Server misconfiguration"]);
export const hydrometerBrewValidationErrorResponseSchema =
  errorEnum(["Missing device_id or brew_name", "Missing brew_id", "Missing device_id for ending brew", "Missing brew_id or recipe_id"]);
export const hydrometerBrewErrorResponseSchema =
  errorEnum(["Failed to get brews.", "Failed to create brew.", "Failed to update brew.", "Failed to delete brew.", "Server misconfiguration"]);
export const hydrometerDeviceErrorResponseSchema =
  errorEnum(["Failed to update device.", "Failed to delete device.", "Server misconfiguration"]);
export const hydrometerLogValidationErrorResponseSchema =
  errorEnum(["Date or Device Id error", "Missing device_id parameter", "Must provide a device id.", "Missing device_id, start_date, or end_date parameters", "Unsupported content type", "Missing required fields", "Error deleting log."]);
export const hydrometerLogErrorResponseSchema =
  errorEnum(["Failed to fetch logs.", "Failed to update log.", "Failed to delete log.", "Error deleting log.", "Failed to log", "Failed to log Tilt data", "Server misconfiguration"]);
export const raptPillRegisterErrorResponseSchema =
  z.object({ error: z.literal("Failed to get device info") });
