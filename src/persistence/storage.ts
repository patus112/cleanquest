export interface StorageStatus {
  usage?: number;
  quota?: number;
  persistent?: boolean;
  persistenceSupported: boolean;
}
export async function storageStatus(): Promise<StorageStatus> {
  const result: StorageStatus = {
    persistenceSupported: !!navigator.storage?.persist,
  };
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) {
      result.usage = estimate.usage;
      result.quota = estimate.quota;
    }
    result.persistent = await navigator.storage?.persisted?.();
  } catch {
    /* Estimates are optional; data operations remain independent. */
  }
  return result;
}
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return undefined;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
export const storageConstrained = (s: StorageStatus) =>
  !!s.quota && s.usage !== undefined && s.usage / s.quota >= 0.85;
export function storageError(
  error: unknown,
  fallback = "Údaje sa nepodarilo uložiť. Skús to znova.",
) {
  if (error && typeof error === "object" && "name" in error) {
    const name = String(error.name);
    if (/quota|storagefull/i.test(name))
      return "Úložisko je plné. Uložené údaje zostali zachované. Exportuj zálohu a uvoľni miesto v zariadení.";
    if (
      ["SecurityError", "InvalidStateError", "DatabaseClosedError"].includes(
        name,
      )
    )
      return "Miestne úložisko nie je dostupné. Skontroluj voľné miesto a povolenie údajov stránok v prehliadači.";
  }
  return error instanceof Error ? error.message : fallback;
}
export function downloadBackup(file: File) {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const canShareBackup = (file: File) => {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
};
export async function shareBackup(
  file: File,
): Promise<"shared" | "cancelled" | "downloaded"> {
  if (!canShareBackup(file)) {
    downloadBackup(file);
    return "downloaded";
  }
  try {
    await navigator.share({ files: [file], title: "Záloha CleanQuest" });
    return "shared";
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      err.name === "AbortError"
    )
      return "cancelled";
    downloadBackup(file);
    return "downloaded";
  }
}
