// Read-only check that a database is correctly prepared for SWD Business OS.
// Run after every deploy/restore:  DATABASE_URL=... npx tsx scripts/db/verify.ts
// Exits 1 (and says what is missing) if anything the safety rules rely on is absent.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL."); process.exit(2); }
const sql = postgres(url, { max: 1 });

const TABLES = [
  "admins", "audit_logs", "inventory_locations", "inventory_balances", "inventory_movements", "sales", "sale_items", "sale_payments",
  "sale_returns", "sale_return_items", "cash_sessions", "cash_movements", "purchase_orders", "goods_receipts", "supplier_invoices",
  "supplier_payments", "customers", "customer_notes", "repair_tickets", "repair_events", "repair_parts", "repair_payments",
  "sop_documents", "sop_versions", "sop_acknowledgements", "app_settings", "pos_terminals", "offline_sync_failures",
];
// table -> trigger that makes it append-only
const TRIGGERS: Record<string, string> = {
  inventory_movements: "inventory_movements_no_update_delete",
  cash_movements: "cash_movements_no_update_delete",
  repair_events: "repair_events_no_update_delete",
  repair_payments: "repair_payments_no_update_delete",
  sop_acknowledgements: "sop_acknowledgements_no_update_delete",
};
const INDEXES = ["cash_sessions_one_open_per_employee", "sop_one_approved_per_doc", "sop_one_draft_per_doc", "pos_one_active_terminal"];

const problems: string[] = [];
const have = new Set((await sql`select table_name from information_schema.tables where table_schema='public'`).map((r) => r.table_name as string));
for (const t of TABLES) if (!have.has(t)) problems.push(`missing table: ${t}`);

const trig = new Set((await sql`select tgname from pg_trigger where not tgisinternal`).map((r) => r.tgname as string));
for (const [table, name] of Object.entries(TRIGGERS)) if (!trig.has(name)) problems.push(`missing append-only trigger on ${table} (run scripts/db/triggers.sql)`);

const idx = new Set((await sql`select indexname from pg_indexes where schemaname='public'`).map((r) => r.indexname as string));
for (const i of INDEXES) if (!idx.has(i)) problems.push(`missing index: ${i}`);

if (have.has("admins")) {
  const [{ owners }] = await sql`select count(*)::int as owners from admins where staff_role = 'OWNER' and active`;
  if (owners < 1) problems.push("no active OWNER account — nobody can manage staff or settings");
}
if (have.has("products") && have.has("inventory_movements")) {
  const [{ n }] = await sql`select count(*)::int as n from products p where p.fulfillment_type='inventory' and p.stock > 0 and not exists (select 1 from inventory_movements m where m.product_id = p.id)`;
  if (n > 0) problems.push(`${n} product(s) have stock but no ledger entry (run scripts/db/opening-balances.sql once)`);
  const [{ drift }] = await sql`
    select count(*)::int as drift from products p
    where p.fulfillment_type='inventory'
      and coalesce((select sum(quantity_change) from inventory_movements m where m.product_id = p.id),0) <> coalesce(p.stock,0)
      and exists (select 1 from inventory_movements m where m.product_id = p.id)`;
  if (drift > 0) problems.push(`${drift} product(s) where the stock ledger total differs from products.stock`);
}

await sql.end();
if (problems.length) { console.error("NOT READY:\n - " + problems.join("\n - ")); process.exit(1); }
console.log(`READY: ${TABLES.length} tables, ${Object.keys(TRIGGERS).length} append-only triggers, ${INDEXES.length} guard indexes, an active owner, stock ledger consistent.`);
