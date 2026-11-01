import Link from "next/link";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission, type Permission } from "@/lib/rbac";

// SWD Business OS — module launcher. Only modules with real, working
// screens behind them are clickable; everything else is phase-tracked
// per the Business OS Implementation Roadmap and shown honestly as not
// yet built, rather than linking to a dead page (per the build rule:
// "do not build decorative buttons that do nothing").
const modules: {
  title: string;
  description: string;
  href: string | null;
  permission: Permission | null;
}[] = [
  {
    title: "Sales & POS",
    description: "Sales, receipts, discounts and returns.",
    href: null,
    permission: "pos.sell",
  },
  {
    title: "Inventory",
    description: "Stock, purchases and stock movements.",
    href: "/admin/business-os/inventory",
    permission: "inventory.view",
  },
  {
    title: "Customers",
    description: "Profiles, contacts and purchase history.",
    href: null,
    permission: "customers.manage",
  },
  {
    title: "Suppliers",
    description: "Supplier directory and purchasing.",
    href: "/admin/suppliers",
    permission: "suppliers.manage",
  },
  {
    title: "Repair Management",
    description: "Repair tickets, technicians and status.",
    href: null,
    permission: "repairs.manage",
  },
  {
    title: "Cash Management",
    description: "Cash, mobile money and reconciliation.",
    href: null,
    permission: "cash.session",
  },
  {
    title: "Staff Management",
    description: "Roles, responsibilities and activity logs.",
    href: "/admin/business-os/staff",
    permission: "staff.manage",
  },
  {
    title: "Reports",
    description: "Daily, weekly and monthly performance.",
    href: null,
    permission: "reports.view",
  },
];

export default async function BusinessOsPage() {
  const session = await getCurrentStaffSession();
  const role = session?.staffRole ?? null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-navy">SWD Business OS</h1>
        <span className="rounded-full bg-light px-2 py-0.5 text-xs font-medium text-slate">
          In progress
        </span>
      </div>
      <p className="mt-1 text-sm text-slate">Internal business management dashboard.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const allowed = m.permission ? hasPermission(role, m.permission) : true;
          const live = m.href !== null;

          if (live && allowed) {
            return (
              <Link
                key={m.title}
                href={m.href!}
                className="rounded-xl border border-border bg-white p-5 transition hover:border-blue hover:shadow-sm"
              >
                <h2 className="font-semibold text-navy">{m.title}</h2>
                <p className="mt-1 text-sm text-slate">{m.description}</p>
              </Link>
            );
          }

          return (
            <div
              key={m.title}
              className="rounded-xl border border-dashed border-border bg-light p-5 opacity-70"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-navy">{m.title}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate">
                  {live ? "No access" : "Coming soon"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate">{m.description}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-slate">
        Role: <span className="font-medium text-navy">{role ?? "unknown"}</span>. Module access is
        enforced on the server, not just hidden here — a card you can&apos;t open is also blocked at
        the API/server-action layer.
      </p>
    </div>
  );
}
