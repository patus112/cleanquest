import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "./components";
export default function UpdateNotice({
  needRefresh,
  offlineReady,
  unbacked,
  busy,
  preparing,
  onUpdate,
  onBackup,
  onDismiss,
}: {
  needRefresh: boolean;
  offlineReady: boolean;
  unbacked: boolean;
  busy: boolean;
  preparing: boolean;
  onUpdate: () => void;
  onBackup: () => void;
  onDismiss: () => void;
}) {
  if (!needRefresh && !offlineReady) return null;
  const offerBackup = needRefresh && unbacked;
  return (
    <div
      className={`notice${offerBackup ? " update-backup" : ""}`}
      role="status"
    >
      <span>
        {needRefresh
          ? offerBackup
            ? "Nová verzia je pripravená. Od poslednej zálohy sa údaje zmenili. Môžeš si ich najprv uložiť."
            : "Nová verzia CleanQuest je pripravená."
          : "CleanQuest je pripravený na použitie bez internetu."}
      </span>
      {offerBackup && (
        <Button variant="secondary" disabled={busy} onClick={onBackup}>
          <Download size={15} />
          {preparing ? "Pripravujem zálohu…" : "Uložiť zálohu"}
        </Button>
      )}
      {needRefresh && (
        <Button
          variant={offerBackup ? "ghost" : "secondary"}
          disabled={busy}
          onClick={onUpdate}
        >
          <RefreshCw size={15} />
          {offerBackup ? "Aktualizovať aj tak" : "Aktualizovať"}
        </Button>
      )}
      <Button
        variant="icon ghost"
        aria-label="Zavrieť oznámenie"
        onClick={onDismiss}
      >
        <X size={16} />
      </Button>
    </div>
  );
}
