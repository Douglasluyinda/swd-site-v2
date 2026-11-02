import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, auditLogs } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { saveBusinessSetting } from "@/lib/admin-actions";
import { getSettings } from "@/lib/settings-service";
import { DEFAULT_SETTINGS, SETTING_DEFS } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";

const input = "w-32 rounded-lg border border-border-strong px-3 py-2 text-sm";

export default async function SettingsPage() {
  const me = await getCurrentStaffSession();
  if (!me || !hasPermission(me.staffRole, "settings.manage")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Settings</h1>
        <p className="mt-2 text-sm text-slate">Only the owner can change business settings.</p>
      </div>
    );
  }
  const current = await getSettings();
  const changes = await db
    .select({ at: auditLogs.createdAt, key: auditLogs.entityId, meta: auditLogs.metadata, by: admins.name, email: auditLogs.actorEmail })
    .from(auditLogs).leftJoin(admins, eq(admins.id, auditLogs.actorId))
    .where(eq(auditLogs.action, "setting.changed")).orderBy(desc(auditLogs.id)).limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Business settings</h1>
        <p className="mt-1 text-sm text-slate">Rules that decide who can do what. Changes take effect immediately and are logged. Until you change a value, the safe default applies.</p>
      </div>
      <div className="space-y-4">
        {SETTING_DEFS.map((d) => (
          <ActionForm key={d.key} action={saveBusinessSetting} className="rounded-xl border border-border bg-white p-5">
            <input type="hidden" name="key" value={d.key} />
            <p className="text-sm font-medium text-navy">{d.label}</p>
            <p className="mt-1 text-xs text-slate">{d.help}</p>
            <div className="mt-3 flex items-center gap-2">
              <input name="value" type="number" min={d.min} max={d.max} step={1} defaultValue={current[d.key]} className={input} aria-label={d.label} />
              <span className="text-sm text-slate">{d.unit}</span>
              <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Save</button>
              <span className="text-xs text-slate">default {DEFAULT_SETTINGS[d.key].toLocaleString()}</span>
            </div>
          </ActionForm>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-white p-5 text-sm">
        <p className="font-medium text-slate">Recent changes</p>
        <ul className="mt-2 divide-y divide-border">
          {changes.map((c, i) => {
            let m: { old?: number; new?: number } = {};
            try { m = c.meta ? JSON.parse(c.meta) : {}; } catch { /* leave blank */ }
            return <li key={i} className="py-2 text-slate">{c.at.toISOString().slice(0, 16).replace("T", " ")} UTC · {SETTING_DEFS.find((d) => d.key === c.key)?.label ?? c.key} · {m.old} → {m.new} · {c.by ?? c.email}</li>;
          })}
          {changes.length === 0 && <li className="py-2 text-slate">No changes yet — defaults in use.</li>}
        </ul>
      </div>
    </div>
  );
}
