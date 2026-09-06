-- Snapshot verified against https://docs.fireworks.ai/serverless/pricing on
-- 2026-08-08. Future provider changes must add a new versioned row and retire
-- this one at the change boundary; never mutate an already-applied price.
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
  'accounts/fireworks/models/deepseek-v4-flash',
  'fireworks-deepseek-v4-flash-standard-2026-08-08',
  140000000000,
  28000000000,
  280000000000,
  '2026-08-08T00:00:00.000Z'
)
ON CONFLICT ("provider", "model", "version") DO NOTHING;

-- The 35% usage markup is the stable reserve for payment processing and a
-- small operating margin. It is distinct from the whole-credit pack price.
INSERT INTO "credit_fee_policy_versions" (
  "version",
  "markup_basis_points",
  "fixed_turn_credits",
  "minimum_turn_credits",
  "effective_at"
)
VALUES (
  'standard-35-percent-2026-08-14',
  3500,
  0,
  1,
  '2026-08-14T00:00:00.000Z'
)
ON CONFLICT ("version") DO NOTHING;
