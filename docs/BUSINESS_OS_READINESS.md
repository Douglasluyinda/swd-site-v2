# SWD Business OS — production readiness review

Reviewed 2 Nov 2026. Everything below marked **verified** was run in this review against a
scratch Postgres 16 and a production build (`next build` + `next start`); nothing here has been
run against the live Neon database or the live site.

## 1. What exists

| Module | State |
|---|---|
| Staff, roles, audit log | Built. 4 fixed roles, default-deny, every action audited |
| Inventory (append-only ledger) | Built |
| Sales & POS, receipts, returns | Built — cash only |
| Cash sessions & reconciliation | Built |
| Suppliers, purchase orders, receiving, supplier balances | Built |
| Customers | Built |
| Repairs | Built — paid in full, in cash, at collection |
| Reports + CSV | Built — shop sales and repairs; online-store orders not included |
| SOP library | Built — 10 of 20 SOPs have text (as drafts); 10 are unwritten |
| Settings & alerts | Built — 6 owner settings; live "needs attention" panel |
| Offline POS | Built — off by default, one designated till, cash only |

## 2. Findings from this review

### Fixed
1. **Deactivated or demoted staff kept their access for up to 8 hours.** The signed cookie carried
   the role and nothing re-checked the database. Pages, actions and API routes now use
   `lib/staff-session.ts`, which re-reads the employee on every request (inactive → no session;
   current role wins over the cookie's). Verified in a browser: deactivating or demoting a
   signed-in cashier takes effect on their very next click. Regression tests cover it, and a
   new test fails if any Business OS page or route skips the database-checked session
   (`business-os-page-gates.test.ts`); the existing test that every server action is
   permission-gated still passes.
2. **No security headers / caching rules.** Added `nosniff`, `X-Frame-Options: DENY`,
   `Referrer-Policy`, `Permissions-Policy`, HSTS, and `Cache-Control: private, no-store` on
   `/admin/*` and `/api/admin/*`. Verified with curl on a production build.

### Accepted (decide knowingly)
- `npm audit` reports 4 high advisories, all one chain: `@vercel/blob` → `@vercel/oidc` →
  `@vercel/cli-config` → `zod` (memory exhaustion on oversized collections). We are on the latest
  `@vercel/blob` (2.8.2); the fix is not available upstream yet. The vulnerable code validates
  Vercel's own configuration, not user input. Re-run `npm audit` at deploy time.
- No Content-Security-Policy (Next inline scripts and Flutterwave make a safe policy a project of
  its own).
- Login rate limiting is per IP, 10 per 15 minutes. No two-factor sign-in. Sessions last 8 hours.
- The offline sale queue in the till's browser is not encrypted (items, totals, optional customer
  phone; no passwords or payment secrets) and is lost if site data is cleared before syncing.
- A secrets scan of tracked files found nothing; `.env*` is git-ignored. (The earlier leaked
  credential was handled in a previous session — rotate it if that has not been done.)

### Not verifiable here
- Behaviour on Neon (pooling, latency, the `max: 1` connection pool under real load beyond the
  single-connection regression tests).
- Real Flutterwave / DSers / SMS / email traffic.
- Real hardware: receipt printers, barcode scanners, the actual till's browser.
- Anything involving real staff behaviour.

## 3. Verified in this review
- Full suite: 276 unit + integration tests and the 6 Playwright specs pass. Integration tests insert rows, so run them only against a scratch database.
- **Migration path on a production-shaped database.** Built a database from the code as it was
  *before* Business OS (the state production was created in), added a legacy admin and a product
  with stock, then applied `0004`…`0011` in order with `psql -v ON_ERROR_STOP=1`. Result: no
  errors; legacy admin became OWNER; existing stock became ledger opening balances; columns,
  indexes and constraints are **identical** to a fresh build from the current schema; all 5
  append-only triggers exist.
- **Backup/restore drill** (`scripts/backup-restore-drill.sh`): dump → restore into an empty
  database → identical row counts for every table → triggers restored → ledger still refuses edits.

## 4. Deploying to production (in this order)
1. **Back up Neon first** (create a branch or snapshot of the production database and confirm it
   exists). Optionally rehearse: restore that backup to a scratch database and run
   `scripts/backup-restore-drill.sh` against it.
2. **Environment variables** on the host: `DATABASE_URL`, `ADMIN_SESSION_SECRET` (random, 32+
   characters; changing it signs everyone out), `NEXT_PUBLIC_SITE_URL`, plus the existing
   Flutterwave / Blob / messaging variables. Leave `DB_POOL_MAX` unset (default 1 on serverless).
3. **Apply the migrations** with the SQL files, not `drizzle-kit push`:
   `for f in drizzle/0004*.sql … drizzle/0011*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
   in that order. This is the path verified above and it also creates the triggers (this replaces
   the earlier note about running triggers by hand after a push). Production was created by
   `push`, so the Drizzle migration history table is not used; do not run `drizzle-kit migrate`.
   If a file fails midway, stop and restore the backup rather than re-running.
4. **Deploy the code**, then `GET /admin/login` and check the headers.
5. **First-run setup** (about 30 minutes, as the owner):
   - Sign in (existing admins became OWNER). Create the real staff accounts and give each the
     lowest role that works. Deactivate or rename any test accounts.
   - Business settings: review discount limits, variance threshold, PO threshold.
   - Inventory: confirm opening balances; enter cost prices and reorder levels (reports and
     alerts are only as good as these).
   - SOPs: "Load the 20-SOP register", review and approve the ten drafts, write the rest,
     have staff acknowledge.
   - Open a cash session and make one small real cash sale and one return as a smoke test.
   - Only if you want offline selling: turn it on and register the one till (see DELIVERY §Y).
6. **Rollback:** the migrations are additive (one relaxation: `customers.email` becomes
   optional). To go back, redeploy the previous code and, if data must be rewound, restore the
   step-1 backup. Previous code runs against the new schema.

## 5. Decisions still yours (currently on safe defaults)
Discount limits (manager 10%, cashier 0%); refund approval by manager/owner; cash variance
5,000 UGX; PO owner threshold 1,000,000 UGX; accepted payment methods (cash only — mobile
money/card are not built); tax and receipt wording; data retention; whether offline selling is
needed and on which till; SOP approver (owner only) and who must acknowledge each SOP; the
"Repair coordinator" role named in SOP-014 (no such role exists).

## 6. Known gaps (not built)
Mobile-money/card payments and their reconciliation; online-store orders in Business OS stock and
reports; sale voiding; deposits and repair refunds; SMS/email alerts and customer notifications;
operating expenses beyond cash-drawer expenses (so "operating profit" is an upper-bound
estimate); supplier performance and price comparison; two-factor sign-in; per-employee reports;
duplicate-customer merge; CSP; printing layouts beyond the receipt and job slip.
