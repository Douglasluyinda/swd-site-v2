// Pure settings registry (no DB). Defaults are the SAFE DEFAULTS the build has
// used from the start; the owner can change them on the Settings page.
// Owner/Technician discount limits are not settings: owner is unlimited,
// technicians cannot discount.

export type SettingKey =
  | "discount.manager_percent"
  | "discount.cashier_percent"
  | "cash.variance_threshold"
  | "purchasing.owner_approval_threshold"
  | "sop.review_months";

type Def = { key: SettingKey; label: string; help: string; unit: string; default: number; min: number; max: number };

export const SETTING_DEFS: Def[] = [
  { key: "discount.manager_percent", label: "Manager discount limit", help: "Highest discount a manager may give on a sale.", unit: "%", default: 10, min: 0, max: 100 },
  { key: "discount.cashier_percent", label: "Cashier discount limit", help: "Highest discount a cashier may give. 0 means cashiers cannot discount.", unit: "%", default: 0, min: 0, max: 100 },
  { key: "cash.variance_threshold", label: "Cash variance needing approval", help: "A closing difference larger than this (either way) must be approved by another manager/owner.", unit: "UGX", default: 5000, min: 0, max: 1_000_000 },
  { key: "purchasing.owner_approval_threshold", label: "Purchase orders needing the owner", help: "Orders above this total can only be approved by the owner.", unit: "UGX", default: 1_000_000, min: 0, max: 1_000_000_000 },
  { key: "sop.review_months", label: "SOP review period", help: "Default months until a newly approved procedure is due for review.", unit: "months", default: 12, min: 1, max: 60 },
];

export type Settings = Record<SettingKey, number>;

export const DEFAULT_SETTINGS: Settings = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.default])) as Settings;

export function isSettingKey(k: string): k is SettingKey {
  return SETTING_DEFS.some((d) => d.key === k);
}

// Bad or out-of-range stored values fall back to the default rather than
// silently loosening a control.
export function resolveSettings(rows: { key: string; value: string }[]): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!isSettingKey(r.key)) continue;
    if (validateSetting(r.key, r.value) === null) out[r.key] = Number(r.value);
  }
  return out;
}

export function validateSetting(key: string, raw: string): string | null {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def) return "Unknown setting.";
  if (!/^\d+$/.test(raw.trim())) return `${def.label} must be a whole number.`;
  const n = Number(raw);
  if (n < def.min || n > def.max) return `${def.label} must be between ${def.min.toLocaleString()} and ${def.max.toLocaleString()} ${def.unit}.`;
  return null;
}

// Cross-setting rule: a cashier can never be allowed more discount than a manager.
export function validateSettingsSet(s: Settings): string | null {
  if (s["discount.cashier_percent"] > s["discount.manager_percent"]) return "The cashier discount limit cannot be higher than the manager's.";
  return null;
}

export function discountLimits(s: Settings): Record<string, number> {
  return { OWNER: 100, MANAGER: s["discount.manager_percent"], CASHIER: s["discount.cashier_percent"], TECHNICIAN: 0 };
}
