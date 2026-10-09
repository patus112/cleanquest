export interface PreparedExport {
  id: string;
  revision: number;
  createdAt: string;
  filename: string;
}
export interface LocalSafety {
  id: "local";
  revision: number;
  reminderDays: 0 | 3 | 7 | 14 | 30;
  dirtySince?: string;
  lastChangedAt?: string;
  lastExport?: PreparedExport;
  confirmed?: PreparedExport & { confirmedAt: string };
  snoozedUntil?: string;
  lastRestoredAt?: string;
}
export const defaultSafety = (): LocalSafety => ({
  id: "local",
  revision: 0,
  reminderDays: 7,
});
export function changedSafety(
  meta: LocalSafety,
  now = new Date().toISOString(),
) {
  if (!meta.dirtySince || meta.confirmed?.revision === meta.revision)
    meta.dirtySince = now;
  meta.revision++;
  meta.lastChangedAt = now;
}
export function backupReminderDue(meta: LocalSafety, now = new Date()) {
  if (
    !meta.reminderDays ||
    !meta.dirtySince ||
    meta.confirmed?.revision === meta.revision
  )
    return false;
  if (meta.snoozedUntil && Date.parse(meta.snoozedUntil) > now.getTime())
    return false;
  const since = meta.confirmed?.confirmedAt || meta.dirtySince;
  return now.getTime() - Date.parse(since) >= meta.reminderDays * 86400000;
}
