import { raptPillCloudIngestRequestBodySchema } from "@meadtools/api-contract/hydrometers";

export function normalizeRaptCloudPayload(body: unknown, queryToken: string | null) {
  const parsed = raptPillCloudIngestRequestBodySchema.safeParse(body);
  if (!parsed.success) return { success: false, error: "Invalid payload" } as const;

  const payload = parsed.data;
  const token = queryToken || payload.token;
  if (!token) return { success: false, error: "Missing token" } as const;

  const stream = "data" in payload;
  const reading = stream ? payload.data : payload;
  return {
    success: true,
    data: {
      token,
      name: payload.name,
      gravity: reading.gravity,
      temperature: reading.temperature,
      temp_units: reading.temp_units ?? (stream ? "C" : "F"),
      battery: reading.battery,
      angle: reading.angle,
      interval: reading.interval,
    },
  } as const;
}
