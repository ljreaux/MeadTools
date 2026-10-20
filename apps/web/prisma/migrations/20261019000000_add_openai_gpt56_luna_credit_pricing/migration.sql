-- Immutable Luna snapshot; matches seed and sync-credit-pricing. Existing
-- databases need this data migration before the hosted model uses Luna.
-- Never update a historical row used to settle prior usage.
INSERT INTO "credit_pricing_versions" (
  "provider", "model", "version",
  "uncached_input_picousd_per_million_tokens",
  "cached_input_picousd_per_million_tokens",
  "output_picousd_per_million_tokens", "effective_at"
)
VALUES (
  'openai', 'gpt-5.6-luna', 'openai-gpt-5.6-luna-standard-2026-10-18',
  200000000000, 20000000000, 1200000000000,
  '2026-10-18T00:00:00.000Z'
)
ON CONFLICT ("provider", "model", "version") DO NOTHING;
