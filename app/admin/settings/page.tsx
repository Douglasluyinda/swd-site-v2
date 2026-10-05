import { business, contact } from "@/lib/config";
import { db } from "@/lib/db/client";
import { admins } from "@/lib/db/schema";
import { createAdmin } from "@/lib/admin-actions";

export default async function AdminSettingsPage() {
  const allAdmins = await db.select({ email: admins.email, name: admins.name, role: admins.role }).from(admins);

  async function createAdminAction(formData: FormData) {
    "use server";
    await createAdmin(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-slate">
          Business identity and contact details are managed in code at{" "}
          <code className="rounded bg-light px-1.5 py-0.5 text-xs">lib/config.ts</code>.
          Current values:
        </p>
        <dl className="mt-6 grid max-w-xl gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate">Name</dt><dd className="text-navy">{business.name}</dd></div>
          <div><dt className="text-slate">Tagline</dt><dd className="text-navy">{business.tagline}</dd></div>
          <div><dt className="text-slate">Launch</dt><dd className="text-navy">{business.launchMonth}</dd></div>
          <div><dt className="text-slate">City</dt><dd className="text-navy">{business.city}, {business.country}</dd></div>
          <div><dt className="text-slate">Contact address</dt><dd className="text-navy">{contact.address}</dd></div>
        </dl>
      </div>

      <div>
        <p className="text-sm font-medium text-slate">Admin accounts</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full max-w-xl text-left text-sm">
            <thead className="border-b border-border text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {allAdmins.map((a) => (
                <tr key={a.email} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-navy">{a.name}</td>
                  <td className="px-4 py-3 text-slate">{a.email}</td>
                  <td className="px-4 py-3 text-slate">{a.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 max-w-xl rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Add admin</p>
          <form action={createAdminAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Name" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="password" type="password" placeholder="Password (8+ chars)" required minLength={8} className="sm:col-span-2 rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
              Add admin
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
