import { z } from "zod";
import { findUnknownField } from "@meadtools/schemas";

export function statelessCalculator<
  N extends string,
  Input extends z.ZodType,
  Result extends z.ZodType,
>(
  name: N,
  description: string,
  inputSchema: Input,
  resultSchema: Result,
  calculate: (input: z.output<Input>) => z.input<Result>,
) {
  const responseSchema = z.strictObject({
    status: z.literal("ok"),
    result: resultSchema,
  });
  return {
    name,
    description,
    inputSchema,
    execute(input: unknown) {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success)
        return {
          status: "invalid_input" as const,
          issues: [z.prettifyError(parsed.error)],
        };
      const unknownField = findUnknownField(input, parsed.data);
      if (unknownField !== undefined)
        return {
          status: "invalid_input" as const,
          issues: [`Unsupported input field: ${unknownField}`],
        };
      try {
        return responseSchema.parse({
          status: "ok",
          result: calculate(parsed.data),
        });
      } catch (error) {
        return {
          status: "invalid_input" as const,
          issues: [
            error instanceof Error
              ? error.message
              : "Unsupported calculator input.",
          ],
        };
      }
    },
    parameters: z.toJSONSchema(inputSchema, { io: "input" }),
    outputSchema: z.toJSONSchema(responseSchema),
  };
}
