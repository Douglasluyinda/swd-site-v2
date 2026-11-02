-- SWD Business OS: append-only protections. `drizzle-kit push` does NOT create
-- triggers, so run this after every push to a new or existing database.
-- Safe to run any number of times (replaces functions, recreates triggers).
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/triggers.sql
BEGIN;

CREATE OR REPLACE FUNCTION inventory_movements_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'inventory_movements is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS inventory_movements_no_update_delete ON inventory_movements;
CREATE TRIGGER inventory_movements_no_update_delete BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION inventory_movements_immutable();

CREATE OR REPLACE FUNCTION cash_movements_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'cash_movements is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS cash_movements_no_update_delete ON cash_movements;
CREATE TRIGGER cash_movements_no_update_delete BEFORE UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION cash_movements_immutable();

CREATE OR REPLACE FUNCTION repair_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS repair_events_no_update_delete ON repair_events;
CREATE TRIGGER repair_events_no_update_delete BEFORE UPDATE OR DELETE ON repair_events
  FOR EACH ROW EXECUTE FUNCTION repair_append_only();
DROP TRIGGER IF EXISTS repair_payments_no_update_delete ON repair_payments;
CREATE TRIGGER repair_payments_no_update_delete BEFORE UPDATE OR DELETE ON repair_payments
  FOR EACH ROW EXECUTE FUNCTION repair_append_only();
DROP TRIGGER IF EXISTS sop_acknowledgements_no_update_delete ON sop_acknowledgements;
CREATE TRIGGER sop_acknowledgements_no_update_delete BEFORE UPDATE OR DELETE ON sop_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION repair_append_only();

COMMIT;
