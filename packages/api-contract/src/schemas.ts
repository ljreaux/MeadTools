export {
  nutrientDataV2Schema,
  recipeDataV2Schema
} from "@meadtools/schemas";
import { z } from "zod";
import { recipeDataV2Schema, volumeUnitSchema } from "@meadtools/schemas";
import type {
  RecipeDerivedStateResponse,
  RecipeDerivedStateResponseBody
} from "./contracts";

const nutrientAmountsByKeyNumberSchema = z.object({
  fermO: z.number(),
  fermK: z.number(),
  dap: z.number(),
  other: z.number()
});

export const recipeDerivedStateResponseSchema: z.ZodType<RecipeDerivedStateResponse> =
  z.object({
    gravity: z.object({
      ogPrimary: z.number(),
      backsweetenedFg: z.number(),
      totalForAbv: z.number()
    }),
    volume: z.object({
      unit: volumeUnitSchema,
      primary: z.number(),
      secondary: z.number(),
      total: z.number(),
      primaryL: z.number(),
      secondaryL: z.number(),
      totalL: z.number()
    }),
    alcohol: z.object({
      abv: z.number(),
      delle: z.number()
    }),
    stabilizers: z.object({
      sorbate: z.number(),
      sulfite: z.number(),
      campden: z.number()
    }),
    nutrients: z.object({
      targetYanPpm: z.number(),
      remainingYanPpm: z.number(),
      numberOfAdditions: z.number(),
      nutrientAdditions: z.object({
        totalGrams: nutrientAmountsByKeyNumberSchema,
        perAddition: nutrientAmountsByKeyNumberSchema
      }),
      providedYanPpm: nutrientAmountsByKeyNumberSchema,
      goFerm: z.object({
        amount: z.number(),
        water: z.number()
      })
    })
  });

export const recipeDerivedStateResponseBodySchema: z.ZodType<RecipeDerivedStateResponseBody> =
  z.object({
    recipeData: recipeDataV2Schema,
    derived: recipeDerivedStateResponseSchema
  });

export const apiErrorResponseSchema = z.object({
  error: z.string()
});
