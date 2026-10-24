\set ON_ERROR_STOP on

-- Run only against a disposable database after applying the inventory migration.
DO $$ BEGIN
  IF current_database() <> 'meadtools_inventory_schema_test' THEN
    RAISE EXCEPTION 'Inventory schema checks require the dedicated disposable database';
  END IF;
END $$;

BEGIN;
CREATE FUNCTION pg_temp.expect_rejected(statement text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, but statement succeeded: %', expected_state, statement;
END $$;

INSERT INTO users (id, email) VALUES
  (-471, 'inventory-owner@fixture.invalid'), (-472, 'inventory-other@fixture.invalid');
INSERT INTO brews (id, user_id) VALUES
  ('00000000-0000-4000-8000-000000000001', -471),
  ('00000000-0000-4000-8000-000000000002', -472);
INSERT INTO inventory_stock (id, user_id, name, category, quantity, unit) VALUES
  ('00000000-0000-4000-8000-000000000003', -471, 'Honey', 'honey', 4, 'kg');

SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET quantity = -1 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET quantity = 1000000001 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET quantity = 'NaN' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET name = '  ' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET catalog = 'ingredient' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET catalog = 'unknown', catalog_id = '42' $q$, '23514');

INSERT INTO inventory_operations (id, user_id, operation_key, request_hash, result) VALUES
  ('00000000-0000-4000-8000-000000000004', -471,
   '00000000-0000-4000-8000-000000000005', repeat('a', 64), '{"balance":4}');
SELECT pg_temp.expect_rejected($q$ INSERT INTO inventory_operations
  (user_id, operation_key, request_hash, result) VALUES
  (-471, '00000000-0000-4000-8000-000000000005', repeat('a', 64), '{}') $q$, '23505');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_operations SET request_hash = 'invalid' $q$, '23514');
-- Account-scoped retry identifiers do not collide across users.
INSERT INTO inventory_operations (user_id, operation_key, request_hash, result) VALUES
  (-472, '00000000-0000-4000-8000-000000000005', repeat('b', 64), '{}');

INSERT INTO inventory_consumptions
  (id, user_id, stock_id, brew_id, entry_id, use_key, deducted, unit) VALUES
  ('00000000-0000-4000-8000-000000000006', -471,
   '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', 1, 'kg');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_consumptions SET user_id = -472 $q$, '23503');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_consumptions SET unit = 'g' $q$, '23503');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_consumptions SET deducted = -1 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ INSERT INTO inventory_consumptions
  (user_id, stock_id, brew_id, entry_id, use_key, deducted, unit)
  SELECT user_id, stock_id, brew_id, entry_id, use_key, deducted, unit
  FROM inventory_consumptions $q$, '23505');

INSERT INTO inventory_adjustments
  (user_id, stock_id, operation_id, consumption_id, kind, delta, balance_after, unit) VALUES
  (-471, '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000006', 'brew_use', -1, 4, 'kg');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_adjustments SET balance_after = -1 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_adjustments SET delta = 0 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_adjustments SET kind = 'receipt' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_adjustments SET consumption_id = NULL $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_adjustments SET user_id = -472 $q$, '23503');
SELECT pg_temp.expect_rejected($q$ INSERT INTO inventory_adjustments
  (user_id, stock_id, operation_id, consumption_id, kind, delta, balance_after, unit)
  SELECT user_id, stock_id, operation_id, consumption_id, kind, delta, balance_after, unit
  FROM inventory_adjustments $q$, '23505');
SELECT pg_temp.expect_rejected($q$ UPDATE inventory_stock SET unit = 'g' $q$, '23503');
SELECT pg_temp.expect_rejected($q$ DELETE FROM inventory_stock $q$, '23503');

INSERT INTO equipment (id, user_id, name, type, capacity, capacity_unit, current_brew_id) VALUES
  ('00000000-0000-4000-8000-000000000009', -471, 'Carboy', 'vessel', 5, 'gal',
   '00000000-0000-4000-8000-000000000001');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET current_brew_id =
  '00000000-0000-4000-8000-000000000002' $q$, '23503');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET capacity = 0 $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET capacity_unit = 'kg' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET capacity_unit = NULL $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET type = 'other' $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET archived_at = now() $q$, '23514');
INSERT INTO equipment_assignment_events
  (user_id, equipment_id, operation_key, to_brew_id) VALUES
  (-471, '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010',
   '00000000-0000-4000-8000-000000000001');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment_assignment_events SET user_id = -472 $q$, '23503');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment_assignment_events SET from_brew_id = to_brew_id $q$, '23514');
SELECT pg_temp.expect_rejected($q$ UPDATE brews SET user_id = -472 WHERE user_id = -471 $q$, '23503');
SELECT pg_temp.expect_rejected($q$ UPDATE equipment SET user_id = -472 $q$, '23503');
SELECT pg_temp.expect_rejected($q$ INSERT INTO equipment_assignment_events
  (user_id, equipment_id, operation_key, to_brew_id)
  SELECT user_id, equipment_id, operation_key, to_brew_id FROM equipment_assignment_events $q$, '23505');

-- Historical brew deletion needs explicit vessel release, never ingredient reversal.
SELECT pg_temp.expect_rejected($q$ DELETE FROM brews WHERE user_id = -471 $q$, '23503');
UPDATE equipment SET current_brew_id = NULL WHERE user_id = -471;
DELETE FROM brews WHERE user_id = -471;
DO $$ BEGIN
  IF (SELECT quantity FROM inventory_stock WHERE user_id = -471) <> 4 OR
     (SELECT count(*) FROM inventory_consumptions WHERE user_id = -471) <> 1 OR
     (SELECT count(*) FROM inventory_adjustments WHERE user_id = -471) <> 1 OR
     (SELECT count(*) FROM equipment_assignment_events WHERE user_id = -471) <> 1 THEN
    RAISE EXCEPTION 'Brew deletion changed stock balances or removed historical records';
  END IF;
END $$;
ROLLBACK;
\echo Inventory migration constraints passed.
