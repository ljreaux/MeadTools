-- Customer credit burn is versioned independently of model prices. The 75%
-- markup keeps the $1 = 1,000-credit retail price while covering Managed
-- Payments fees and the target operating margin for the beta and paid launch.
INSERT INTO "credit_fee_policy_versions" (
  "version",
  "markup_basis_points",
  "fixed_turn_credits",
  "minimum_turn_credits",
  "effective_at"
)
VALUES (
  'standard-75-percent-2026-08-15',
  7500,
  0,
  1,
  '2026-08-15T00:00:00.000Z'
)
ON CONFLICT ("version") DO NOTHING;
