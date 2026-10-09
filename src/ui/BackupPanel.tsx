import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload, ShieldCheck, HardDrive } from "lucide-react";
import type { State } from "../domain/model";
import { changedSafety, type LocalSafety } from "../domain/localSafety";
import type { Repository } from "../persistence/repository";
import {
  openBackup,
  prepareBackup,
  type PreparedBackup,
  type ValidatedBackup,
} from "../persistence/backup";
import { storePhotos } from "../persistence/photos";
import {
  canShareBackup,
  downloadBackup,
  shareBackup,
  storageError,
  requestPersistentStorage,
  storageConstrained,
  type StorageStatus,
} from "../persistence/storage";
import { Button, Dialog, Field } from "./components";
import BackupPreview from "./BackupPreview";
export const sizeLabel = (bytes: number) =>
  bytes < 1000000
    ? `${Math.max(1, Math.round(bytes / 1000))} kB`
    : `${(bytes / 1000000).toLocaleString("sk-SK", { maximumFractionDigits: 1 })} MB`;
export default function BackupPanel({
  s,
  safety,
  repository,
  refresh,
  restore,
  resetData,
  storage,
  refreshStorage,
}: {
  s: State;
  safety: LocalSafety;
  repository: Repository;
  refresh: () => Promise<void>;
  restore: (backup: ValidatedBackup) => Promise<boolean>;
  resetData: () => Promise<boolean>;
  storage: StorageStatus;
  refreshStorage: () => Promise<void>;
}) {
  const [candidate, setCandidate] = useState<ValidatedBackup | null>(null),
    [prepared, setPrepared] = useState<PreparedBackup | null>(null),
    [delivered, setDelivered] = useState(false),
    [reset, setReset] = useState(false),
    [working, setWorking] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const section = useRef<HTMLElement>(null);
  const closePrepared = () => {
    setPrepared(null);
    if (!candidate && !reset)
      requestAnimationFrame(() =>
        section.current
          ?.querySelector<HTMLButtonElement>("[data-backup-export]")
          ?.focus({ preventScroll: true }),
      );
  };
  useEffect(() => {
    if (location.hash.includes("section=backup"))
      section.current?.scrollIntoView({ block: "start" });
  }, []);
  const dataSize = useMemo(() => {
    const stored = storePhotos(s);
    return (
      new Blob([JSON.stringify(stored.state)]).size +
      stored.photos.reduce((n, p) => n + p.bytes.length, 0)
    );
  }, [s]);
  const prepare = async () => {
    setError("");
    setMessage("");
    setWorking("prepare");
    try {
      const snapshot = await repository.readSnapshot(),
        value = await prepareBackup(snapshot.state, snapshot.safety);
      setPrepared(value);
      setDelivered(false);
      try {
        await repository.markExportPrepared(value.export);
        await refresh();
      } catch (err) {
        setError(
          `Súbor je pripravený, ale história exportu sa neuložila. ${storageError(err)}`,
        );
      }
    } catch (err) {
      setError(storageError(err, "Zálohu sa nepodarilo pripraviť."));
    } finally {
      setWorking("");
    }
  };
  const act = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(storageError(err));
    }
  };
  return (
    <>
      <section
        ref={section}
        className="card backup-card spaced"
        aria-labelledby="backup-title"
        id="backup-settings"
      >
        <div className="section-heading">
          <h3 id="backup-title">
            <ShieldCheck size={22} /> Zálohovanie a obnova
          </h3>
          <span className="tag">V TOMTO ZARIADENÍ</span>
        </div>
        <p>
          Údaje sú uložené v tomto zariadení. Ak stratíš telefón alebo vymažeš
          údaje aplikácie, bez zálohy ich nemusí byť možné obnoviť.
        </p>
        <div className="backup-facts">
          <div>
            <small>Posledná potvrdená záloha</small>
            <strong>
              {safety.confirmed
                ? new Date(safety.confirmed.confirmedAt).toLocaleString("sk-SK")
                : "Zatiaľ nepotvrdená"}
            </strong>
          </div>
          <div>
            <small>Stav zálohy</small>
            <strong>
              {safety.confirmed?.revision === safety.revision
                ? "Aktuálna záloha je potvrdená"
                : safety.confirmed
                  ? "Od zálohy sa údaje zmenili"
                  : "Uloženie zálohy ešte nie je potvrdené"}
            </strong>
          </div>
          <div>
            <small>Približná veľkosť údajov domácnosti</small>
            <strong>{sizeLabel(dataSize)}</strong>
          </div>
        </div>
        {safety.lastExport && (
          <p className="small">
            Posledný pripravený export:{" "}
            {new Date(safety.lastExport.createdAt).toLocaleString("sk-SK")}.
            Príprava súboru sama nepotvrdzuje jeho uloženie.
          </p>
        )}
        <p className="small">
          ZIP záloha obsahuje miestnosti, úlohy, históriu, DA ⚡, odmeny,
          nastavenia aj fotografie. Miesto uloženia si vyberáš ty; automatická
          cloudová záloha ani synchronizácia nie sú zapnuté.
        </p>
        <div className="actions">
          <Button
            data-backup-export
            disabled={!!working}
            onClick={() => void prepare()}
          >
            <Download size={17} />{" "}
            {working === "prepare"
              ? "Pripravujem zálohu…"
              : "Exportovať zálohu"}
          </Button>
          <label className={`button secondary ${working ? "disabled" : ""}`}>
            <Upload size={17} />{" "}
            {working === "validate" ? "Overujem zálohu…" : "Vybrať zálohu"}
            <input
              className="file-hidden"
              type="file"
              accept=".zip,.json,application/zip,application/json"
              disabled={!!working}
              onChange={async (e) => {
                const input = e.currentTarget,
                  file = input.files?.[0];
                input.value = "";
                if (!file) return;
                setCandidate(null);
                setError("");
                setMessage("");
                setWorking("validate");
                try {
                  setCandidate(await openBackup(file));
                } catch (err) {
                  setError(storageError(err, "Záloha sa nedá načítať."));
                } finally {
                  setWorking("");
                }
              }}
            />
          </label>
        </div>
        <Field
          label="Pripomínať zálohu"
          hint="Pripomienka sa zobrazí iba v aplikácii, keď sa údaje od poslednej potvrdenej zálohy zmenili. Upratovanie nepreruší."
        >
          <select
            value={safety.reminderDays}
            onChange={(e) => {
              const days = Number(
                e.target.value,
              ) as LocalSafety["reminderDays"];
              void act(async () => {
                await repository.updateSafety((meta) => {
                  if (meta.reminderDays !== days) {
                    changedSafety(meta);
                    meta.reminderDays = days;
                  }
                });
                await refresh();
              });
            }}
          >
            <option value="7">Každých 7 dní</option>
            <option value="3">Každé 3 dni</option>
            <option value="14">Každých 14 dní</option>
            <option value="30">Každých 30 dní</option>
            <option value="0">Bez pripomienok</option>
          </select>
        </Field>
        <details className="spaced">
          <summary>
            <HardDrive size={16} /> Úložisko a ochrana údajov
          </summary>
          <p className="small">
            {storage.usage !== undefined && storage.quota
              ? `Úložisko prehliadača: približne ${sizeLabel(storage.usage)} z ${sizeLabel(storage.quota)}. Zahŕňa údaje aj offline balík aplikácie.`
              : "Prehliadač neposkytuje odhad dostupného úložiska."}
          </p>
          <p className="small">
            {storage.persistent
              ? "Prehliadač povolil trvalé úložisko. Pravidelná záloha zostáva užitočná."
              : storage.persistenceSupported
                ? "Trvalé úložisko zatiaľ nie je potvrdené. Pravidelne si ukladaj zálohu."
                : "Prehliadač nepodporuje žiadosť o trvalé úložisko. Pravidelne si ukladaj zálohu."}
          </p>
          {storageConstrained(storage) && (
            <p role="status" className="error">
              Úložisko sa zapĺňa. Ulož si zálohu a uvoľni miesto v zariadení.
            </p>
          )}
          <Button
            variant="secondary"
            disabled={!storage.persistenceSupported}
            onClick={() =>
              void act(async () => {
                const granted = await requestPersistentStorage();
                await refreshStorage();
                setMessage(
                  granted
                    ? "Prehliadač povolil trvalé úložisko."
                    : "Prehliadač trvalé úložisko nepotvrdil. Pravidelne si ukladaj zálohu.",
                );
              })
            }
          >
            Požiadať prehliadač o trvalé úložisko
          </Button>
          <p className="small">
            Na iPhone: Safari → Zdieľať → Pridať na plochu. Údaje domácnosti sú
            oddelené od offline vyrovnávacej pamäte; aktualizácia aplikácie ich
            nemaže.
          </p>
          <Button variant="danger" onClick={() => setReset(true)}>
            Vymazať všetky miestne údaje
          </Button>
        </details>
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {candidate && !prepared && (
        <BackupPreview
          backup={candidate}
          onClose={() => setCandidate(null)}
          exportCurrent={() => void prepare()}
          busy={working === "restore"}
          error={error}
          onConfirm={() => {
            setWorking("restore");
            void restore(candidate)
              .then((ok) => {
                if (ok) {
                  setCandidate(null);
                  setMessage("Záloha bola obnovená a skontrolovaná.");
                } else
                  setError(
                    "Obnova zlyhala. Pôvodné údaje zostali zachované. Skontroluj voľné miesto a skús to znova.",
                  );
              })
              .finally(() => setWorking(""));
          }}
        />
      )}
      {prepared && (
        <Dialog title="Záloha je pripravená" onClose={closePrepared}>
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
                  void act(async () => {
                    const result = await shareBackup(prepared.file);
                    if (result !== "cancelled") setDelivered(true);
                  })
                }
              >
                Zdieľať / uložiť súbor
              </Button>
            )}
            <Button
              variant={canShareBackup(prepared.file) ? "secondary" : ""}
              onClick={() => {
                downloadBackup(prepared.file);
                setDelivered(true);
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
          {safety.revision !== prepared.export.revision && (
            <p>
              Od prípravy zálohy sa údaje zmenili. Tento súbor obsahuje skorší
              stav domácnosti.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button
            disabled={!delivered || !!working}
            onClick={() =>
              void act(async () => {
                setWorking("confirm");
                try {
                  await repository.confirmBackup(prepared.export.id);
                  await refresh();
                  closePrepared();
                  setMessage("Uloženie zálohy je potvrdené.");
                } finally {
                  setWorking("");
                }
              })
            }
          >
            Zálohu mám bezpečne uloženú
          </Button>
          <Button variant="ghost" onClick={closePrepared}>
            Zatvoriť bez potvrdenia
          </Button>
        </Dialog>
      )}
      {reset && !prepared && (
        <Dialog title="Vymazať miestne údaje?" onClose={() => setReset(false)}>
          <p>
            Toto odstráni domácnosť, fotografie, históriu aj odmeny z tohto
            zariadenia. Bez uloženej zálohy ich neobnovíš.
          </p>
          <div className="actions">
            <Button variant="secondary" onClick={() => void prepare()}>
              Najprv exportovať zálohu
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                void resetData().then((ok) => {
                  if (ok) setReset(false);
                })
              }
            >
              Potvrdiť vymazanie
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
