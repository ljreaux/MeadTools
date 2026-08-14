-- DeepSeek-V4-Flash-0731 replaced the older preview model identifier. The
-- provider-reported standard serverless rates were checked on 2026-08-14.
INSERT INTO "credit_pricing_versions" (
  "provider",
  "model",
  "version",
  "uncached_input_picousd_per_million_tokens",
  "cached_input_picousd_per_million_tokens",
  "output_picousd_per_million_tokens",
  "effective_at"
)
VALUES (
  'fireworks',
  'accounts/fireworks/models/deepseek-v4-flash-0731',
  'fireworks-deepseek-v4-flash-0731-standard-2026-08-14',
  140000000000,
  28000000000,
  280000000000,
  '2026-08-14T00:00:00.000Z'
)
ON CONFLICT ("provider", "model", "version") DO NOTHING;

UPDATE "credit_pricing_versions"
SET "retired_at" = '2026-08-14T00:00:00.000Z'
WHERE "provider" = 'fireworks'
  AND "model" = 'accounts/fireworks/models/deepseek-v4-flash'
  AND "retired_at" IS NULL;
