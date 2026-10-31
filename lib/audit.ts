// Append-only audit log for sensitive Business OS actions. Insert-only from
// application code — nothing here ever updates or deletes a row.

import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export async function recordAuditEvent(event: {
  actorId?: number | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: event.actorId ?? null,
      actorEmail: event.actorEmail ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId != null ? String(event.entityId) : undefined,
      metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
    });
  } catch (err) {
    // Audit logging must never take down the action it's recording.
    console.error("Failed to record audit event", event.action, err);
  }
}
