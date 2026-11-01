"use client";

import { useActionState, type ReactNode } from "react";

// Wraps a server action that returns { ok:false, error } so a rejected rule
// shows inline instead of Next's generic error page.
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;

export function ActionForm({
  action, children, className,
}: { action: (formData: FormData) => Promise<ActionResult>; children: ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(async (_prev: ActionResult, fd: FormData) => action(fd), null);
  return (
    <form action={run} className={className} aria-busy={pending}>
      {children}
      {state && !state.ok && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state && state.ok && state.message && <p className="mt-2 text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
