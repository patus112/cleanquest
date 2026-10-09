import type { ValidatedBackup } from "../persistence/backup";
import { balance, totalXp } from "../domain/rewards";
import { money } from "../domain/model";
import { Button, Dialog } from "./components";
import { photoAttachmentCount } from "../persistence/photos";
export default function BackupPreview({
  backup,
  onClose,
  onConfirm,
  exportCurrent,
  busy = false,
  error,
}: {
  backup: ValidatedBackup;
  onClose: () => void;
  onConfirm: () => void;
  exportCurrent?: () => void;
  busy?: boolean;
  error?: string;
}) {
  return (
    <Dialog
      title="Obnoviť túto zálohu?"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h3>{backup.data.households[0]?.name || "Prázdna domácnosť"}</h3>
      <p>
        {backup.data.rooms.length} miestností · {backup.data.tasks.length} úloh
        · {backup.data.completions.length} dokončení
      </p>
      <p>Priložené fotografie: {photoAttachmentCount(backup.data)}</p>
      <p>
        {totalXp(backup.data)} DA ⚡ · virtuálny zostatok{" "}
        {money(balance(backup.data))} · {backup.data.rewards.length} transakcií
      </p>
      <p>Záloha z {new Date(backup.exportedAt).toLocaleString("sk-SK")}.</p>
      <div className="quiet-note">
        {backup.verified
          ? "Štruktúra, fotografie, vzťahy a kontrolné súčty sú overené."
          : "Staršia JSON záloha: štruktúra a vzťahy sú overené, kontrolné súčty neobsahuje."}
      </div>
      <p className="spaced">
        Potvrdením nahradíš všetky terajšie údaje v tomto zariadení. Najprv si
        môžeš uložiť ich zálohu. Pri zlyhaní obnovy zostanú pôvodné údaje
        zachované.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        {exportCurrent && (
          <Button variant="secondary" disabled={busy} onClick={exportCurrent}>
            Zálohovať terajšie údaje
          </Button>
        )}
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? "Obnovujem…" : "Potvrdiť nahradenie"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Zrušiť
        </Button>
      </div>
    </Dialog>
  );
}
