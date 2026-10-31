import { db } from "@/lib/db/client";
import { admins } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission, STAFF_ROLES } from "@/lib/rbac";
import { createStaffAccount, setStaffActive, setStaffRole } from "@/lib/admin-actions";

export default async function StaffManagementPage() {
  const session = await getCurrentStaffSession();
  const allowed = hasPermission(session?.staffRole, "staff.manage");

  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Staff Management</h1>
        <p className="mt-2 text-sm text-slate">
          Your account (role: {session?.staffRole ?? "unknown"}) does not have permission to manage
          staff.
        </p>
      </div>
    );
  }

  const staff = await db.select().from(admins).orderBy(desc(admins.createdAt));

  async function createStaffAction(formData: FormData) {
    "use server";
    await createStaffAccount(formData);
  }

  async function changeRoleAction(formData: FormData) {
    "use server";
    await setStaffRole(formData.get("staffId") as string, formData.get("staffRole") as string);
  }

  async function toggleActiveAction(formData: FormData) {
    "use server";
    await setStaffActive(formData.get("staffId") as string, formData.get("active") === "true");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Staff Management</h1>
        <p className="mt-1 text-sm text-slate">
          Individual employee accounts only — no shared logins. Role changes and
          activation/deactivation are written to the audit log.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Employee #</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-navy">{s.name || "—"}</td>
                <td className="px-4 py-3 text-slate">{s.email}</td>
                <td className="px-4 py-3 text-slate">{s.employeeNumber || "—"}</td>
                <td className="px-4 py-3">
                  <form action={changeRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="staffId" value={s.id} />
                    <select
                      name="staffRole"
                      defaultValue={s.staffRole}
                      className="rounded-lg border border-border-strong px-2 py-1 text-xs"
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-light px-2 py-1 text-xs font-medium text-navy hover:bg-border">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.active ? "bg-light text-slate" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {s.active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="staffId" value={s.id} />
                    <input type="hidden" name="active" value={(!s.active).toString()} />
                    <button
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        s.active
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-light text-navy hover:bg-border"
                      }`}
                    >
                      {s.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate">
                  No staff accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Add employee</p>
        <form action={createStaffAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Full name"
            required
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Temporary password (min 8 chars)"
            required
            minLength={8}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="employeeNumber"
            placeholder="Employee number (optional)"
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <select
            name="staffRole"
            required
            defaultValue="CASHIER"
            className="rounded-lg border border-border-strong px-3 py-2 text-sm sm:col-span-2"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white sm:col-span-2">
            Add employee
          </button>
        </form>
      </div>
    </div>
  );
}
