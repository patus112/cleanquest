import { Home, Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Field, PageHead, type ScreenProps } from "./components";
import { type Settings, uid, emptyState } from "../domain/model";
import { HouseholdMap } from "./RoomVisual";
import BackupPanel from "./BackupPanel";
import type { LocalSafety } from "../domain/localSafety";
import type { Repository } from "../persistence/repository";
import type { ValidatedBackup } from "../persistence/backup";
import type { StorageStatus } from "../persistence/storage";
export default function Profile({
  s,
  run,
  open,
  replace,
  navigate,
  safety,
  repository,
  refreshSafety,
  restoreBackup,
  storage,
  refreshStorage,
}: {
  replace: (s: ScreenProps["s"]) => Promise<boolean>;
  navigate: (page: string) => void;
  safety: LocalSafety;
  repository: Repository;
  refreshSafety: () => Promise<void>;
  restoreBackup: (backup: ValidatedBackup) => Promise<boolean>;
  storage: StorageStatus;
  refreshStorage: () => Promise<void>;
} & ScreenProps) {
  const settings = s.settings[0],
    h = s.households[0];
  return (
    <>
      <PageHead
        eyebrow="DOMOV PODĽA TEBA"
        title="Tvoj rytmus, tvoje pravidlá."
        text="Všetko si môžeš upraviť. Aj tempo."
      />
      <section className="card household-summary">
        <div className="icon-tile">
          <Home />
        </div>
        <div>
          <h2>{h.name}</h2>
          <p>
            {h.type === "house" ? "Dom" : "Byt"} · {s.floors.length} podlaží ·{" "}
            {s.rooms.length} miestností · {h.residentCount} obyvateľov
            {h.totalArea > 0 && ` · ${h.totalArea} m²`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => open({ kind: "household" })}>
          <Pencil size={16} />
          Upraviť
        </Button>
      </section>
      <section className="card spaced">
        <HouseholdMap s={s} onSelect={(id) => open({ kind: "room", id })} />
        <div className="actions">
          <Button
            variant="secondary"
            onClick={() => navigate("tasks?tab=rooms")}
          >
            <Home size={17} />
            Miestnosti, predmety a úlohy
          </Button>
        </div>
      </section>
      <div className="two-column">
        <section className="card">
          <h3>Čas a energia</h3>
          <form
            key={JSON.stringify(settings)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run((state) => {
                const set = state.settings[0];
                set.dailyBudget = Number(
                  f.get("budget"),
                ) as Settings["dailyBudget"];
                set.energy = Number(f.get("energy")) as Settings["energy"];
                set.intensity =
                  set.energy === 1
                    ? "gentle"
                    : set.energy === 3
                      ? "active"
                      : "balanced";
                set.restDays = f.getAll("rest").map(Number);
                set.specialNeeds = String(f.get("specialNeeds"));
              }, "Nastavenie je uložené. Dohodnutý týždeň zostáva zachovaný.");
            }}
          >
            <Field label="Denný čas">
              <select name="budget" defaultValue={settings.dailyBudget}>
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} minút
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Potrebná energia">
              <select name="energy" defaultValue={settings.energy}>
                <option value="1">Jemné tempo</option>
                <option value="2">Vyvážené tempo</option>
                <option value="3">Aktívne tempo</option>
              </select>
            </Field>
            <span className="field-label">Dni voľna</span>
            <div className="day-checks">
              {["Ne", "Po", "Ut", "St", "Št", "Pi", "So"].map((label, i) => (
                <label key={label}>
                  <input
                    name="rest"
                    type="checkbox"
                    value={i}
                    defaultChecked={settings.restDays.includes(i)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Field label="Špeciálne potreby">
              <textarea
                name="specialNeeds"
                defaultValue={settings.specialNeeds}
              />
            </Field>
            <small>
              Zmeny plánu platia od ďalšieho týždňa. Dnešný krátky blok môžeš
              zvoliť na domovskej obrazovke.
            </small>
            <Button type="submit">Uložiť tempo</Button>
          </form>
        </section>
        <section className="card">
          <h3>Vzhľad a odmeny</h3>
          <Field label="Vzhľad">
            <select
              value={settings.theme}
              onChange={(e) => {
                const theme = e.target.value as Settings["theme"];
                void run((state) => {
                  state.settings[0].theme = theme;
                });
              }}
            >
              <option value="dark">Tmavý</option>
              <option value="light">Svetlý</option>
              <option value="system">Podľa zariadenia</option>
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.haptics}
              onChange={(e) => {
                const checked = e.target.checked;
                void run((state) => {
                  state.settings[0].haptics = checked;
                });
              }}
            />
            Jemná vibrácia pri dokončení (ak je dostupná)
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run((state) => {
                state.settings[0].monetary = f.has("monetary");
                state.settings[0].weeklyCents = Math.round(
                  Number(f.get("weekly")) * 100,
                );
                state.settings[0].bonusCents = Math.round(
                  Number(f.get("bonus")) * 100,
                );
              }, "Odmeny boli nastavené pre ďalšie plány.");
            }}
          >
            <label className="check">
              <input
                name="monetary"
                type="checkbox"
                defaultChecked={settings.monetary}
              />
              Virtuálne peňažné odmeny
            </label>
            <div className="form-grid">
              <Field label="Týždenná odmena (€)">
                <input
                  name="weekly"
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  defaultValue={settings.weeklyCents / 100}
                />
              </Field>
              <Field label="Dobrovoľný bonus (€)">
                <input
                  name="bonus"
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  defaultValue={settings.bonusCents / 100}
                />
              </Field>
            </div>
            <small>
              Najviac 25 € novej virtuálnej odmeny za týždeň. Už dohodnuté
              odmeny zostávajú zachované.
            </small>
            <Button type="submit">Uložiť odmeny</Button>
          </form>
        </section>
      </div>
      <section className="card spaced">
        <div className="section-heading">
          <h3>Podlažia a miestnosti</h3>
          <Button
            variant="secondary"
            onClick={() => navigate("tasks?tab=rooms")}
          >
            Spravovať miestnosti
          </Button>
        </div>
        {s.floors.map((f) => (
          <form
            className="floor-row"
            key={f.id}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void run((state) => {
                state.floors.find((x) => x.id === f.id)!.name = String(
                  fd.get("name"),
                );
              });
            }}
          >
            <input
              aria-label={`Názov podlažia ${f.name}`}
              name="name"
              required
              defaultValue={f.name}
            />
            <Button variant="ghost" type="submit">
              Uložiť
            </Button>
            <Button
              variant="icon ghost"
              disabled={s.floors.length === 1}
              aria-label={`Odstrániť podlažie ${f.name}`}
              onClick={() =>
                open({ kind: "delete", entity: "floor", id: f.id })
              }
            >
              <Trash2 size={16} />
            </Button>
          </form>
        ))}
        <Button
          variant="ghost"
          onClick={() =>
            void run((state) =>
              state.floors.push({
                id: uid(),
                householdId: h.id,
                name: `${state.floors.length}. poschodie`,
                order: state.floors.length,
              }),
            )
          }
        >
          <Plus size={16} />
          Pridať podlažie
        </Button>
        <Button variant="ghost" onClick={() => open({ kind: "room" })}>
          <Plus size={16} />
          Pridať miestnosť
        </Button>
      </section>
      <BackupPanel
        s={s}
        safety={safety}
        repository={repository}
        refresh={refreshSafety}
        restore={restoreBackup}
        resetData={() => replace(emptyState())}
        storage={storage}
        refreshStorage={refreshStorage}
      />
    </>
  );
}
