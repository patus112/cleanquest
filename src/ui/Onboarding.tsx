import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Leaf,
  Home,
  Check,
  Sparkles,
} from "lucide-react";
import { Button, Field } from "./components";
import { createHousehold, type Setup } from "../data/household";
import {
  type State,
  type RoomCategory,
  type ObjectCategory,
  roomLabels,
  objectLabels,
  uid,
} from "../domain/model";
import { openBackup, type ValidatedBackup } from "../persistence/backup";
import BackupPreview from "./BackupPreview";
import { generateTasks } from "../data/templates";
import { storageError } from "../persistence/storage";
const days = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
export default function Onboarding({
  save,
  error,
  busy,
  restore,
}: {
  save: (s: State) => Promise<void>;
  error: string;
  busy: boolean;
  restore?: (backup: ValidatedBackup) => Promise<boolean>;
}) {
  const [step, setStep] = useState(0),
    [setup, setSetup] = useState<Setup>({
      name: "Môj domov",
      displayName: "",
      type: "apartment",
      area: 0,
      floors: 1,
      residents: 1,
      children: false,
      pets: false,
      template: false,
      rooms: ["kitchen", "bathroom", "living", "bedroom"],
      budget: 15,
      restDays: [0],
      monetary: true,
      intensity: "balanced",
      specialNeeds: "",
    });
  const [backup, setBackup] = useState<ValidatedBackup | null>(null),
    [checking, setChecking] = useState(false),
    [restoreError, setRestoreError] = useState(""),
    [creating, setCreating] = useState(false),
    [creationError, setCreationError] = useState("");
  const [inventory, setInventory] = useState<
    Partial<Record<RoomCategory, ObjectCategory[]>>
  >({});
  const update = (patch: Partial<Setup>) => setSetup({ ...setup, ...patch });
  const finish = async () => {
    if (creating || busy) return;
    setCreating(true);
    setCreationError("");
    try {
      const s = createHousehold(setup);
      if (!setup.template) {
        for (const room of s.rooms) {
          for (const category of inventory[room.category] || [])
            s.objects.push({
              id: uid(),
              householdId: room.householdId,
              roomId: room.id,
              name: objectLabels[category],
              category,
              quantity: 1,
              dimensions: "",
              surface: "",
              accessibility: "safe",
              notes: "",
            });
        }
        s.tasks.push(...generateTasks(s));
      }
      await save(s);
    } catch (err) {
      setCreationError(
        storageError(err, "Domov sa nepodarilo vytvoriť. Skús to znova."),
      );
    } finally {
      setCreating(false);
    }
  };
  return (
    <main className="onboarding">
      <div className="onboard-brand">
        <Leaf size={23} />
        CleanQuest
      </div>
      <div className="onboard-layout">
        <aside>
          <span className="eyebrow">MALÉ KROKY. VEĽKÝ ROZDIEL.</span>
          <h1>
            Viac pokoja.
            <br />
            <em>Menej odkladania.</em>
          </h1>
          <p>
            Domov, v ktorom sa cítiš dobre. Jedna drobná úloha za druhou,
            vlastným tempom.
          </p>
          <div className="onboard-orbit">
            <Home size={70} strokeWidth={1} />
            <span>
              <Sparkles size={20} /> Tvoj domov, tvoj rytmus
            </span>
          </div>
        </aside>
        <section className="onboard-card">
          <div className="step-indicator">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i <= step ? "active" : ""} />
            ))}
            <span>{step + 1} / 4</span>
          </div>
          {step === 0 && (
            <>
              <span className="tag">VITAJ DOMA</span>
              <h2>Začneme tvojím domovom.</h2>
              <p>
                Vyber, ako chceš začať. Obe možnosti si môžeš neskôr upraviť.
              </p>
              <button
                className={`setup-option ${!setup.template ? "selected" : ""}`}
                aria-pressed={!setup.template}
                onClick={() => update({ template: false })}
              >
                <Home />
                <span>
                  <strong>Nastaviť od začiatku</strong>
                  <small>
                    Vyberieš miestnosti a vybavenie svojho bytu alebo domu.
                  </small>
                </span>
                {!setup.template && <Check />}
              </button>
              <button
                className={`setup-option ${setup.template ? "selected" : ""}`}
                aria-pressed={setup.template}
                onClick={() =>
                  update({ template: true, type: "house", floors: 2 })
                }
              >
                <Sparkles />
                <span>
                  <strong>Použiť pripravený dom</strong>
                  <small>
                    Začneš so 14 miestnosťami a základným vybavením
                    dvojpodlažného domu. Upravíš si ich podľa seba.
                  </small>
                </span>
                {setup.template && <Check />}
              </button>
              <div className="quiet-note">
                Bez účtu. Údaje zostávajú iba v tomto zariadení.
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Ako voláme tvoj domov?</h2>
              <Field label="Názov domácnosti">
                <input
                  value={setup.name}
                  maxLength={100}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </Field>
              <Field label="Tvoje meno (voliteľné)">
                <input
                  value={setup.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                  placeholder="Ako ťa máme osloviť?"
                />
              </Field>
              <div className="form-grid">
                <Field label="Typ">
                  <select
                    value={setup.type}
                    onChange={(e) =>
                      update({ type: e.target.value as Setup["type"] })
                    }
                  >
                    <option value="apartment">Byt</option>
                    <option value="house">Dom</option>
                  </select>
                </Field>
                <Field label="Počet podlaží">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={setup.floors}
                    disabled={setup.template}
                    onChange={(e) =>
                      update({
                        floors: Math.max(
                          1,
                          Math.min(10, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Rozloha v m² (voliteľné)">
                  <input
                    type="number"
                    min="0"
                    value={setup.area || ""}
                    onChange={(e) =>
                      update({ area: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </Field>
                <Field label="Počet obyvateľov">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={setup.residents}
                    onChange={(e) =>
                      update({ residents: Math.max(1, Number(e.target.value)) })
                    }
                  />
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={setup.children}
                  onChange={(e) => update({ children: e.target.checked })}
                />
                Deti v domácnosti
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={setup.pets}
                  onChange={(e) => update({ pets: e.target.checked })}
                />
                Domáce zvieratá
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2>
                {setup.template
                  ? "Čo obsahuje pripravený dom?"
                  : "Čo je u teba doma?"}
              </h2>
              <p>
                {setup.template
                  ? "Miestnosti aj vybavenie sú už pridané. Po vytvorení domácnosti ich môžeš premenovať, doplniť alebo odstrániť."
                  : "Vyber miestnosti. Predmety sú voliteľné a môžeš ich doplniť aj neskôr."}
              </p>
              {setup.template ? (
                <div className="template-preview">
                  Prízemie: vstup, chodba, kúpeľňa, kuchyňa, obývačka, jedáleň,
                  terasa.
                  <br />
                  <br />
                  Poschodie: detská izba, herňa, chodba, spálňa, WC, kúpeľňa,
                  balkón.
                  <br />
                  <br />
                  Okná v obývačke: prednastavená plocha 14 m². Jednotlivé panely
                  pridáš podľa svojho domu.
                  <br />
                  <br />
                  Balkón zatiaľ nie je zahrnutý do pravidelného upratovania.
                </div>
              ) : (
                <div className="room-choices">
                  {Object.entries(roomLabels).map(([key, label]) => (
                    <div key={key}>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={setup.rooms.includes(key as RoomCategory)}
                          onChange={(e) =>
                            update({
                              rooms: e.target.checked
                                ? [...setup.rooms, key as RoomCategory]
                                : setup.rooms.filter((r) => r !== key),
                            })
                          }
                        />
                        {label}
                      </label>
                      {setup.rooms.includes(key as RoomCategory) && (
                        <details>
                          <summary>Predmety a spotrebiče</summary>
                          <div className="inventory-choices">
                            {(
                              [
                                "sink",
                                "toilet",
                                "tap",
                                "mirror",
                                "bathtub",
                                "shower",
                                "cabinet",
                                "drawer",
                                "shelf",
                                "table",
                                "chair",
                                "bed",
                                "wardrobe",
                                "toy",
                                "sofa",
                                "tv",
                                "speaker",
                                "glass",
                                "fridge",
                                "oven",
                                "hob",
                                "washer",
                                "dryer",
                                "carpet",
                                "door",
                                "bin",
                              ] as ObjectCategory[]
                            ).map((cat) => (
                              <label key={cat} className="check">
                                <input
                                  type="checkbox"
                                  checked={(
                                    inventory[key as RoomCategory] || []
                                  ).includes(cat)}
                                  onChange={(e) =>
                                    setInventory({
                                      ...inventory,
                                      [key]: e.target.checked
                                        ? [
                                            ...(inventory[
                                              key as RoomCategory
                                            ] || []),
                                            cat,
                                          ]
                                        : (
                                            inventory[key as RoomCategory] || []
                                          ).filter((c) => c !== cat),
                                    })
                                  }
                                />
                                {objectLabels[cat]}
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h2>Stačí pár minút.</h2>
              <p>
                Pravidelnosť je viac než dokonalosť. Dni voľna sú súčasť plánu.
              </p>
              <fieldset className="field">
                <legend>Denný čas</legend>
                <div className="segments">
                  {[5, 10, 15, 20, 30].map((n) => (
                    <button
                      key={n}
                      className={setup.budget === n ? "active" : ""}
                      onClick={() => update({ budget: n as Setup["budget"] })}
                    >
                      {n} min
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>Dni voľna</legend>
                <div className="segments">
                  {days.map((d, i) => (
                    <button
                      key={d}
                      aria-pressed={setup.restDays.includes(i)}
                      className={setup.restDays.includes(i) ? "active" : ""}
                      onClick={() =>
                        update({
                          restDays: setup.restDays.includes(i)
                            ? setup.restDays.filter((v) => v !== i)
                            : [...setup.restDays, i],
                        })
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label="Tempo">
                <select
                  value={setup.intensity}
                  onChange={(e) =>
                    update({ intensity: e.target.value as Setup["intensity"] })
                  }
                >
                  <option value="gentle">Jemné · málo energie</option>
                  <option value="balanced">Vyvážené</option>
                  <option value="active">Aktívne</option>
                </select>
              </Field>
              <Field label="Špeciálne potreby (voliteľné)">
                <textarea
                  value={setup.specialNeeds}
                  onChange={(e) => update({ specialNeeds: e.target.value })}
                  placeholder="Citlivé povrchy, alergie, obľúbené pomôcky…"
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={setup.monetary}
                  onChange={(e) => update({ monetary: e.target.checked })}
                />
                Virtuálna týždenná odmena 20 € + dobrovoľných 5 €
              </label>
              <small>
                Osobný rozpočet na odmenu. Aplikácia nedrží ani neposiela
                peniaze.
              </small>
            </>
          )}
          {(creationError || error) && (
            <p className="error" role="alert">
              {creationError || error}
            </p>
          )}
          <div className="onboard-actions">
            {step > 0 && (
              <Button
                variant="ghost"
                disabled={busy || creating}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={18} />
                Späť
              </Button>
            )}
            <Button
              disabled={
                busy ||
                creating ||
                !setup.name.trim() ||
                (!setup.template && !setup.rooms.length)
              }
              aria-busy={busy || creating}
              onClick={() => (step < 3 ? setStep(step + 1) : void finish())}
            >
              {busy || creating
                ? "Ukladám…"
                : step < 3
                  ? "Pokračovať"
                  : "Vytvoriť môj domov"}
              <ArrowRight size={18} />
            </Button>
          </div>
        </section>
      </div>
      <footer>
        2–5 minút na úlohu. Pokrok bez tlaku.
        <div className="restore-onboarding">
          <label className="button ghost">
            Obnoviť zo zálohy
            <input
              className="file-hidden"
              type="file"
              accept=".zip,.json,application/zip,application/json"
              disabled={checking || busy || creating}
              onChange={async (e) => {
                const input = e.currentTarget,
                  file = input.files?.[0];
                input.value = "";
                setBackup(null);
                try {
                  if (!file) return;
                  setChecking(true);
                  setCreationError("");
                  setBackup(await openBackup(file));
                  setRestoreError("");
                } catch (err) {
                  setRestoreError(
                    err instanceof Error
                      ? err.message
                      : "Záloha sa nedá načítať.",
                  );
                } finally {
                  setChecking(false);
                }
              }}
            />
          </label>
          {checking && <p role="status">Overujem zálohu…</p>}
          {restoreError && (
            <p className="error" role="alert">
              {restoreError}
            </p>
          )}
        </div>
      </footer>
      {backup && (
        <BackupPreview
          backup={backup}
          busy={busy}
          error={error || restoreError}
          onClose={() => setBackup(null)}
          onConfirm={() =>
            void (restore
              ? restore(backup).then((ok) => {
                  if (ok) setBackup(null);
                })
              : save(backup.data))
          }
        />
      )}
    </main>
  );
}
