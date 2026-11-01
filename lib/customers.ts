// Pure customer rules (no DB).

// Uganda-first phone normalisation to E.164. Returns null if it doesn't look
// like a usable number (so callers can reject it rather than store junk).
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().replace(/[\s\-().]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("+")) {
    return /^\+\d{9,15}$/.test(d) ? d : null;
  }
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("256") && d.length === 12) return "+" + d;
  if (d.startsWith("0") && d.length === 10) return "+256" + d.slice(1);
  if (d.length === 9) return "+256" + d; // 7XXXXXXXX typed without the leading 0
  return null;
}

export const NOTE_KINDS = ["NOTE", "COMPLAINT", "WARRANTY"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const CHANNELS = ["PHONE", "WHATSAPP", "SMS", "EMAIL"] as const;

export function validateCustomer(input: { name: string; phone: string; email?: string | null }): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!normalizePhone(input.phone)) return "Enter a valid phone number (e.g. 0772 123456).";
  const email = input.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email address looks invalid.";
  return null;
}

export function validateNote(input: { kind: string; text: string }): string | null {
  if (!(NOTE_KINDS as readonly string[]).includes(input.kind)) return "Invalid note type.";
  if (!input.text.trim()) return "Write something first.";
  if (input.text.length > 2000) return "Notes are limited to 2,000 characters.";
  return null;
}
