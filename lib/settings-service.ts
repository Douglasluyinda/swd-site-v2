import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { resolveSettings, validateSetting, validateSettingsSet, type SettingKey, type Settings } from "@/lib/settings";

type Executor = Pick<typeof db, "select">;

// Pass `tx` inside a transaction (single-connection pool).
export async function getSettings(executor: Executor = db): Promise<Settings> {
  return resolveSettings(await executor.select().from(appSettings));
}

export async function setSetting(input: { key: SettingKey; value: string; by: number }) {
  const err = validateSetting(input.key, input.value);
  if (err) throw new Error(err);
  return db.transaction(async (tx) => {
    const before = await getSettings(tx);
    const next = { ...before, [input.key]: Number(input.value) } as Settings;
    const crossErr = validateSettingsSet(next);
    if (crossErr) throw new Error(crossErr);
    await tx.insert(appSettings).values({ key: input.key, value: String(Number(input.value)), updatedBy: input.by })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: String(Number(input.value)), updatedBy: input.by, updatedAt: new Date() } });
    return { old: before[input.key], new: next[input.key] };
  });
}
