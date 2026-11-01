import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, cashMovements, cashSessions } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { getOpenSession, sessionTotals } from "@/lib/cash-sessions";
import {
  approveCashSession, closeCashSession, correctCashSession, openCashSession, recordCashMovement,
} from "@/lib/admin-actions";
import { CASH_VARIANCE_THRESHOLD } from "@/lib/cash";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";
const fmt = (n: number) => n.toLocaleString();

export default async function CashPage() {
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "cash.session")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Cash Management</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to cash sessions.</p>
      </div>
    );
  }
  const reviewer = hasPermission(me?.staffRole, "cash.reconcile");
  const myId = Number(me!.adminId);

  const open = await getOpenSession(db, myId);
  const totals = open ? await sessionTotals(db, open.id, open.openingFloat) : null;
  const movements = open
    ? await db.select().from(cashMovements).where(eq(cashMovements.sessionId, open.id)).orderBy(desc(cashMovements.id))
    : [];

  const history = await db
    .select({
      id: cashSessions.id, status: cashSessions.status, openedAt: cashSessions.openedAt,
      closedAt: cashSessions.closedAt, opening: cashSessions.openingFloat, counted: cashSessions.countedCash,
      expected: cashSessions.expectedCash, variance: cashSessions.variance, note: cashSessions.varianceNote,
      who: admins.name, employeeId: cashSessions.employeeId,
    })
    .from(cashSessions)
    .innerJoin(admins, eq(admins.id, cashSessions.employeeId))
    .orderBy(desc(cashSessions.id))
    .limit(30);
  const visible = reviewer ? history : history.filter((h) => h.employeeId === myId);

  async function openAction(f: FormData) { "use server"; await openCashSession(f); }
  async function moveAction(f: FormData) { "use server"; await recordCashMovement(f); }
  async function closeAction(f: FormData) { "use server"; await closeCashSession(f); }
  async function approveAction(f: FormData) { "use server"; await approveCashSession(f); }
  async function correctAction(f: FormData) { "use server"; await correctCashSession(f); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Cash Management</h1>
        <p className="mt-1 text-sm text-slate">
          Every cash sale and refund belongs to the employee&apos;s open session. Closed sessions are never edited —
          fixes are logged corrections. Variance beyond {fmt(CASH_VARIANCE_THRESHOLD)} UGX needs another
          manager/owner to approve. Cash only for now; mobile-money and card reconciliation arrive with those payment types.
        </p>
      </div>

      {!open && (
        <form action={openAction} className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Open your cash session</p>
          <div className="mt-3 flex gap-3">
            <input name="openingFloat" type="number" min={0} step={1} required placeholder="Opening float (UGX)" className={input} />
            <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Open session</button>
          </div>
          <p className="mt-2 text-xs text-slate">You must have an open session to make sales or process refunds.</p>
        </form>
      )}

      {open && totals && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">
            Session #{open.id} open since {open.openedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-slate">Opening float</dt><dd className="text-navy">{fmt(totals.openingFloat)}</dd></div>
            <div><dt className="text-slate">Cash sales</dt><dd className="text-navy">{fmt(totals.cashSales)}</dd></div>
            <div><dt className="text-slate">Cash refunds</dt><dd className="text-navy">-{fmt(totals.cashRefunds)}</dd></div>
            <div><dt className="text-slate">Expenses</dt><dd className="text-navy">-{fmt(totals.expenses)}</dd></div>
            <div><dt className="text-slate">Withdrawals</dt><dd className="text-navy">-{fmt(totals.withdrawals)}</dd></div>
            <div><dt className="text-slate">Deposits</dt><dd className="text-navy">{fmt(totals.deposits)}</dd></div>
            <div><dt className="text-slate">Repair payments</dt><dd className="text-navy">{fmt(totals.repairPayments)}</dd></div>
          </dl>
          {reviewer ? (
            <p className="text-sm font-semibold text-navy">Expected in drawer: {fmt(totals.expected)} UGX</p>
          ) : (
            <p className="text-xs text-slate">Count the drawer first — the expected total is shown after you close.</p>
          )}

          <form action={moveAction} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sessionId" value={open.id} />
            <select name="type" className={input}>
              <option value="EXPENSE">Expense</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="DEPOSIT">Deposit</option>
            </select>
            <input name="amount" type="number" min={1} step={1} required placeholder="Amount" className={input} />
            <input name="reason" required placeholder="Reason" className={input} />
            <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Record</button>
          </form>
          {movements.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between py-1.5">
                  <span className="text-slate">{m.type} — {m.reason}</span>
                  <span className="text-navy">{fmt(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <form action={closeAction} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <input type="hidden" name="sessionId" value={open.id} />
            <input name="counted" type="number" min={0} step={1} required placeholder="Counted cash (UGX)" className={input} />
            <input name="note" placeholder="Variance explanation (if any)" className={input} />
            <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Close session</button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <p className="px-4 pt-4 text-sm font-medium text-slate">{reviewer ? "Cash sessions" : "Your cash sessions"}</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Expected</th>
              <th className="px-4 py-3 font-medium">Counted</th>
              <th className="px-4 py-3 font-medium">Variance</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((h) => (
              <tr key={h.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3 text-slate">{h.id}</td>
                <td className="px-4 py-3 text-navy">{h.who ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${h.status === "PENDING_APPROVAL" ? "bg-red-50 text-red-600" : "bg-light text-slate"}`}>{h.status}</span>
                </td>
                <td className="px-4 py-3 text-slate">{h.expected != null && (reviewer || h.status !== "OPEN") ? fmt(h.expected) : "—"}</td>
                <td className="px-4 py-3 text-slate">{h.counted != null ? fmt(h.counted) : "—"}</td>
                <td className="px-4 py-3 font-medium text-navy">{h.variance != null ? fmt(h.variance) : "—"}</td>
                <td className="px-4 py-3 text-slate">{h.note ?? "—"}</td>
                <td className="px-4 py-3">
                  {reviewer && h.status === "PENDING_APPROVAL" && h.employeeId !== myId && (
                    <form action={approveAction}>
                      <input type="hidden" name="sessionId" value={h.id} />
                      <button className="rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white">Approve</button>
                    </form>
                  )}
                  {reviewer && h.status === "PENDING_APPROVAL" && h.employeeId === myId && (
                    <span className="text-xs text-slate">Needs another approver</span>
                  )}
                  {reviewer && h.status !== "OPEN" && (
                    <form action={correctAction} className="mt-1 flex gap-1">
                      <input type="hidden" name="sessionId" value={h.id} />
                      <input name="amount" type="number" step={1} placeholder="±amt" required className="w-20 rounded-lg border border-border-strong px-2 py-1 text-xs" />
                      <input name="reason" placeholder="Correction reason" required className="w-32 rounded-lg border border-border-strong px-2 py-1 text-xs" />
                      <button className="rounded-lg bg-light px-2 py-1 text-xs text-navy">Correct</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate">No sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
