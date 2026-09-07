-- Direct OpenAI price snapshot verified against https://openai.com/api/pricing/
-- on 2026-08-14. This is immutable accounting data: model upgrades receive
-- a new row rather than changing the rate that settled historical usage.
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
  'openai',
  'gpt-5.4-mini-2026-03-17',
  'openai-gpt-5.4-mini-2026-03-17-2026-08-14',
  750000000000,
  75000000000,
  4500000000000,
  '2026-08-14T00:00:00.000Z'
)
ON CONFLICT ("provider", "model", "version") DO NOTHING;
