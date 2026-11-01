import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customerNotes, customers } from "@/lib/db/schema";
import { normalizePhone, validateCustomer, validateNote } from "@/lib/customers";

// Pass `tx` when already inside a transaction (single-connection pool).
type Executor = Pick<typeof db, "select" | "insert" | "update">;

// One phone = one shop customer. Race-safe: the unique index decides, and the
// loser of a concurrent insert simply reads the winner's row.
export async function findOrCreateByPhone(
  executor: Executor,
  input: { name: string; phone: string; email?: string | null; location?: string | null },
) {
  const err = validateCustomer(input);
  if (err) throw new Error(err);
  const phoneNormalized = normalizePhone(input.phone)!;

  await executor
    .insert(customers)
    .values({
      fullName: input.name.trim(), phone: phoneNormalized, phoneNormalized,
      email: input.email?.trim().toLowerCase() || null, location: input.location?.trim() || null,
    })
    .onConflictDoNothing();
  const [c] = await executor.select().from(customers).where(eq(customers.phoneNormalized, phoneNormalized)).limit(1);
  if (!c) {
    // Insert skipped on an email clash with someone not yet linked to this phone.
    throw new Error("A customer with that email already exists. Search for them by name or email.");
  }
  return c;
}

export async function updateCustomer(id: number, input: {
  name: string; phone: string; email?: string | null; location?: string | null;
  preferredChannel?: string | null; marketingOptIn: boolean;
}) {
  const err = validateCustomer(input);
  if (err) throw new Error(err);
  const phoneNormalized = normalizePhone(input.phone)!;
  try {
    await db.update(customers).set({
      fullName: input.name.trim(), phone: phoneNormalized, phoneNormalized,
      email: input.email?.trim().toLowerCase() || null, location: input.location?.trim() || null,
      preferredChannel: input.preferredChannel || null, marketingOptIn: input.marketingOptIn,
    }).where(eq(customers.id, id));
  } catch {
    throw new Error("Another customer already uses that phone number or email.");
  }
}

export async function addCustomerNote(input: { customerId: number; kind: string; text: string; employeeId: number }) {
  const err = validateNote(input);
  if (err) throw new Error(err);
  await db.insert(customerNotes).values({
    customerId: input.customerId, kind: input.kind, text: input.text.trim(), employeeId: input.employeeId,
  });
}
