-- Issue #437: read-only, de-identified export for estimating primary transfer loss.
-- Run in the Supabase SQL editor and export the result as CSV. This query does
-- not return user IDs, brew IDs, recipe names, notes, or ingredient names.
-- Each row is the earliest volume entry recorded while moving a brew from
-- primary to secondary. The optional starting volume can be a recipe fallback,
-- so previous_measured_l is the stronger pre-transfer measurement when present.

WITH transfer_entries AS (
  SELECT
    b.id AS internal_brew_id,
    b.recipe_snapshot::jsonb -> 'dataV2' AS recipe_data,
    e.datetime AS transfer_time,
    CASE WHEN (e.data::jsonb ->> 'liters') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (e.data::jsonb ->> 'liters')::numeric
    END AS post_transfer_l,
    CASE WHEN (e.data::jsonb ->> 'startingLiters') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (e.data::jsonb ->> 'startingLiters')::numeric
    END AS displayed_start_l,
    row_number() OVER (PARTITION BY b.id ORDER BY e.datetime, e.id) AS transfer_number
  FROM brews AS b
  JOIN brew_entries AS e ON e.brew_id = b.id
  WHERE e.type = 'VOLUME'
    AND jsonb_typeof(b.recipe_snapshot::jsonb -> 'dataV2') = 'object'
    AND (e.data::jsonb ->> 'liters') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (e.data::jsonb ->> 'startingLiters') ~ '^[0-9]+(\.[0-9]+)?$'
)
SELECT
  t.post_transfer_l,
  t.displayed_start_l,
  prior.previous_measured_l,
  COALESCE(ingredients.primary_ingredients, '[]'::jsonb) AS primary_ingredients
FROM transfer_entries AS t
LEFT JOIN LATERAL (
  SELECT CASE WHEN (e.data::jsonb ->> 'liters') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN (e.data::jsonb ->> 'liters')::numeric
  END AS previous_measured_l
  FROM brew_entries AS e
  WHERE e.brew_id = t.internal_brew_id
    AND e.type = 'VOLUME'
    AND e.datetime < t.transfer_time
    AND (e.data::jsonb ->> 'liters') ~ '^[0-9]+(\.[0-9]+)?$'
  ORDER BY e.datetime DESC, e.id DESC
  LIMIT 1
) AS prior ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', CASE
        WHEN lower(line ->> 'category') IN
          ('water', 'sugar', 'fruit', 'dried fruit', 'vegetable', 'juice')
          THEN lower(line ->> 'category')
        ELSE 'other'
      END,
      'weight_value', line #>> '{amounts,weight,value}',
      'weight_unit', line #>> '{amounts,weight,unit}',
      'volume_value', line #>> '{amounts,volume,value}',
      'volume_unit', line #>> '{amounts,volume,unit}'
    )
  ) AS primary_ingredients
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.recipe_data -> 'ingredients') = 'array'
        THEN t.recipe_data -> 'ingredients'
      ELSE '[]'::jsonb
    END
  ) AS line
  WHERE line ->> 'secondary' = 'false'
) AS ingredients ON true
WHERE t.transfer_number = 1
  AND t.post_transfer_l > 0
  AND t.displayed_start_l > 0;
