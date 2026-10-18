import type { Repository } from "../persistence/repository";
import { prepareBackup, type PreparedBackup } from "../persistence/backup";
import { storageError } from "../persistence/storage";
export async function prepareCurrentBackup(repository: Repository): Promise<{
  prepared: PreparedBackup;
  warning: string;
}> {
  const snapshot = await repository.readSnapshot();
  const prepared = await prepareBackup(snapshot.state, snapshot.safety);
  try {
    await repository.markExportPrepared(prepared.export);
    return { prepared, warning: "" };
  } catch (err) {
    return {
      prepared,
      warning: `Súbor je pripravený, ale história exportu sa neuložila. ${storageError(err)}`,
    };
  }
}
