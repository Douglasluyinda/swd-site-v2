-- ONE-TIME data step for a database that already has products with stock: turn
-- products.stock into opening ledger entries at the "Main shop" location so the
-- stock ledger reconciles with current stock from day one. Run it once, BEFORE
-- the first POS sale or stock movement. Idempotent: products that already have
-- any ledger entry are skipped, so a second run changes nothing.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/opening-balances.sql
BEGIN;
INSERT INTO inventory_locations (name) VALUES ('Main shop') ON CONFLICT DO NOTHING;

WITH todo AS (
  SELECT p.id AS product_id, l.id AS location_id, p.stock
  FROM products p CROSS JOIN inventory_locations l
  WHERE l.name = 'Main shop' AND p.stock > 0 AND p.fulfillment_type = 'inventory'
    AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.product_id = p.id)
), bal AS (
  INSERT INTO inventory_balances (product_id, location_id, quantity)
  SELECT product_id, location_id, stock FROM todo
  ON CONFLICT (product_id, location_id) DO NOTHING
  RETURNING product_id
)
INSERT INTO inventory_movements (product_id, location_id, movement_type, quantity_change, balance_after, reference, note)
SELECT product_id, location_id, 'ADJUSTMENT_IN', stock, stock, 'OPENING_BALANCE', 'Opening balance from products.stock at ledger introduction'
FROM todo;

COMMIT;
