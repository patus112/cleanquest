import type { PreparedBackup } from "../persistence/backup";
import {
  canShareBackup,
  downloadBackup,
  shareBackup,
  storageError,
} from "../persistence/storage";
import { Button, Dialog } from "./components";
export const sizeLabel = (bytes: number) =>
  bytes < 1000000
    ? `${Math.max(1, Math.round(bytes / 1000))} kB`
    : `${(bytes / 1000000).toLocaleString("sk-SK", { maximumFractionDigits: 1 })} MB`;
export default function BackupReadyDialog({
  prepared,
  currentRevision,
  delivered,
  busy,
  error,
  onDelivered,
  onError,
  onConfirm,
  onClose,
}: {
  prepared: PreparedBackup;
  currentRevision: number;
  delivered: boolean;
  busy: boolean;
  error: string;
  onDelivered: () => void;
  onError: (message: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title="Záloha je pripravená" onClose={onClose}>
      <p>
        <strong>{prepared.file.name}</strong>
        <br />
        {sizeLabel(prepared.file.size)} · Súbory fotografií:{" "}
        {prepared.manifest.photoCount}
      </p>
      <p>
        Súbor je pripravený. Ulož ho do Súborov alebo ho zdieľaj na miesto,
        ktorému dôveruješ. Aplikácia nevie overiť, kam si ho uložila.
      </p>
      <div className="actions">
        {canShareBackup(prepared.file) && (
          <Button
            onClick={() =>
              void (async () => {
                try {
                  const result = await shareBackup(prepared.file);
                  if (result !== "cancelled") onDelivered();
                } catch (err) {
                  onError(storageError(err));
                }
              })()
            }
          >
            Zdieľať / uložiť súbor
          </Button>
        )}
        <Button
          variant={canShareBackup(prepared.file) ? "secondary" : ""}
          onClick={() => {
            downloadBackup(prepared.file);
            onDelivered();
          }}
        >
          Stiahnuť ZIP
        </Button>
      </div>
      <div className="quiet-note spaced">
        {delivered
          ? "Stiahnutie alebo zdieľanie bolo spustené. Potvrď uloženie až keď vieš, že súbor máš bezpečne uložený."
          : "Príprava zálohy ešte neznamená, že je bezpečne uložená."}
      </div>
      {currentRevision !== prepared.export.revision && (
        <p>
          Od prípravy zálohy sa údaje zmenili. Tento súbor obsahuje skorší stav
          domácnosti.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button disabled={!delivered || busy} onClick={onConfirm}>
        Zálohu mám bezpečne uloženú
      </Button>
      <Button variant="ghost" onClick={onClose}>
        Zatvoriť bez potvrdenia
      </Button>
    </Dialog>
  );
}
