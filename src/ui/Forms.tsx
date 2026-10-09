import { useState, type FormEvent } from "react";
import { Plus, Check } from "lucide-react";
import {
  type Task,
  type Room,
  type Inventory,
  type Problem,
  type Recurrence,
  type ObjectCategory,
  type RoomCategory,
  uid,
  roomLabels,
  objectLabels,
  problemStatuses,
  flooringLabels,
  type FlooringType,
} from "../domain/model";
import {
  saveTask,
  dayOf,
  deleteRoom,
  deleteTask,
  splitTask,
  redeem,
  propose,
} from "../domain/commands";
import { generateTasks } from "../data/templates";
import {
  Button,
  Dialog,
  Field,
  PhotoInput,
  photoFrom,
  str,
  num,
  type ModalType,
  type ScreenProps,
} from "./components";
import Focus from "./Focus";
import { saveRoom, saveObject, moveObject } from "../domain/rooms";
import { RoomIcon, TaskLocation } from "./RoomVisual";
import RoomLayoutEditor from "./RoomLayoutEditor";
import { snapshot } from "../domain/scheduler";
const Submit = () => (
  <Button type="submit">
    <Check size={18} />
    Uložiť
  </Button>
);
export default function Forms({
  s,
  run,
  open,
  modal,
  sessionBudget,
}: { modal: ModalType } & ScreenProps) {
  const [error, setError] = useState("");
  if (!modal) return null;
  const close = () => open(null),
    hid = s.households[0].id;
  const done = async (
    recipe: Parameters<typeof run>[0],
    message = "Uložené.",
  ) => {
    if (await run(recipe, message)) close();
  };
  const handle =
    (action: (f: FormData) => Promise<void>) =>
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      try {
        await action(new FormData(e.currentTarget));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Údaje sa nepodarilo uložiť.",
        );
      }
    };
  const formEnd = (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Submit />
    </>
  );
  if (modal.kind === "focus")
    return <Focus s={s} run={run} open={open} sessionBudget={sessionBudget} />;
  if (modal.kind === "layout")
    return (
      <RoomLayoutEditor s={s} run={run} open={open} roomId={modal.roomId} />
    );
  if (modal.kind === "move-object") {
    const object = s.objects.find((o) => o.id === modal.id);
    return (
      <Dialog title="Presunúť do inej miestnosti" onClose={close}>
        {object ? (
          <form
            onSubmit={handle(async (f) => {
              await done(
                (state) => moveObject(state, object.id, str(f, "roomId")),
                "Predmet aj jeho úlohy sú v novej miestnosti.",
              );
            })}
          >
            <h3>{object.name}</h3>
            <p>
              Spolu s predmetom sa presunú jeho úlohy a priradené nápady.
              História aj odmeny zostanú zachované.
            </p>
            <Field label="Cieľová miestnosť">
              <select name="roomId" defaultValue={object.roomId}>
                {s.rooms
                  .filter((r) => r.householdId === object.householdId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {s.floors.find((f) => f.id === r.floorId)?.name} ·{" "}
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <small>
              V novej miestnosti dostane automatickú polohu. Rozloženie si potom
              môžeš upraviť.
            </small>
            {formEnd}
          </form>
        ) : (
          <p>Predmet už nie je dostupný.</p>
        )}
      </Dialog>
    );
  }
  if (modal.kind === "location") {
    const original = s.dailyPlans
        .flatMap((p) => p.occurrences)
        .find((o) => o.id === modal.occurrenceId),
      task = s.tasks.find((t) => t.id === modal.taskId),
      occurrence = original || (task ? snapshot(s, task, dayOf(s)) : undefined);
    return (
      <Dialog title="Miesto malého kroku" onClose={close}>
        {occurrence ? (
          <>
            <h3>{occurrence.title}</h3>
            <TaskLocation s={s} task={occurrence} />
            <Button variant="secondary" onClick={close}>
              Späť k úlohám
            </Button>
          </>
        ) : (
          <p>Úloha už nie je dostupná.</p>
        )}
      </Dialog>
    );
  }
  if (modal.kind === "task")
    return <TaskForm {...{ s, run, open }} modal={modal} />;
  if (modal.kind === "room") {
    const room = s.rooms.find((r) => r.id === modal.id);
    return (
      <Dialog
        title={room ? "Upraviť miestnosť" : "Nová miestnosť"}
        onClose={close}
      >
        <form
          onSubmit={handle(async (f) => {
            const photo = await photoFrom(f, "photo", room?.photo);
            const value: Room = {
              id: room?.id || uid(),
              householdId: hid,
              name: str(f, "name"),
              category: str(f, "category") as RoomCategory,
              floorId: str(f, "floorId"),
              flooring: str(f, "flooring") as Room["flooring"],
              area: num(f, "area") || undefined,
              width: num(f, "width") || undefined,
              length: num(f, "length") || undefined,
              windowArea:
                str(f, "windowArea") === "" ? undefined : num(f, "windowArea"),
              curtains:
                str(f, "curtains") === ""
                  ? undefined
                  : str(f, "curtains") === "yes",
              blinds:
                str(f, "blinds") === ""
                  ? undefined
                  : str(f, "blinds") === "yes",
              floorSurfaces: (Object.keys(flooringLabels) as FlooringType[])
                .filter(
                  (m) => f.has(`surface-${m}`) && m !== str(f, "flooring"),
                )
                .map((material) => ({
                  material,
                  area: num(f, `surface-area-${material}`) || undefined,
                })),
              enabled: f.has("enabled"),
              order: room?.order ?? s.rooms.length,
              zones: str(f, "zones").split("\n").filter(Boolean),
              photo,
            };
            await done((state) => {
              saveRoom(state, value);
              state.tasks.push(...generateTasks(state));
            });
          })}
        >
          <div className="form-room-intro">
            <span className="room-icon-tile">
              <RoomIcon category={room?.category || "other"} size={30} />
            </span>
            <p>
              Popíš svoj priestor. Úlohy a náhľad sa prispôsobia tomu, čo tu
              naozaj máš.
            </p>
          </div>
          <Field label="Názov">
            <input
              name="name"
              required
              maxLength={150}
              defaultValue={room?.name}
            />
          </Field>
          <div className="form-grid">
            <Field label="Kategória">
              <select name="category" defaultValue={room?.category || "other"}>
                {Object.entries(roomLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Podlažie">
              <select name="floorId" defaultValue={room?.floorId}>
                {s.floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Podlaha">
              <select name="flooring" defaultValue={room?.flooring || "other"}>
                <option value="tile">Dlažba</option>
                <option value="laminate">Plávajúca podlaha / laminát</option>
                <option value="carpet">Koberec</option>
                <option value="wood">Drevo</option>
                <option value="other">Iný materiál</option>
              </select>
            </Field>
            <Field label="Rozloha v m²">
              <input
                type="number"
                name="area"
                min="0.1"
                step="0.1"
                max="100000"
                defaultValue={room?.area}
              />
            </Field>
          </div>
          <details className="room-config-section" open>
            <summary>Rozmery a povrchy</summary>
            <div className="form-grid">
              <Field label="Šírka miestnosti (m)">
                <input
                  name="width"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  defaultValue={room?.width}
                  placeholder="Voliteľné"
                />
              </Field>
              <Field label="Dĺžka miestnosti (m)">
                <input
                  name="length"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  defaultValue={room?.length}
                  placeholder="Voliteľné"
                />
              </Field>
            </div>
            <span className="field-label">Ďalšie povrchy v miestnosti</span>
            <small>
              Napríklad koberec na plávajúcej podlahe. Hlavnú podlahu netreba
              označiť druhýkrát.
            </small>
            <div className="surface-choices">
              {Object.entries(flooringLabels).map(([material, label]) => (
                <div key={material}>
                  <label className="check">
                    <input
                      name={`surface-${material}`}
                      type="checkbox"
                      defaultChecked={room?.floorSurfaces?.some(
                        (s) => s.material === material,
                      )}
                    />
                    {label}
                  </label>
                  <input
                    name={`surface-area-${material}`}
                    type="number"
                    min="0.1"
                    max="100000"
                    step="0.1"
                    aria-label={`Plocha: ${label} (m²)`}
                    placeholder="m² (voliteľné)"
                    defaultValue={
                      room?.floorSurfaces?.find((s) => s.material === material)
                        ?.area
                    }
                  />
                </div>
              ))}
            </div>
          </details>
          <details className="room-config-section" open>
            <summary>Okná a textílie</summary>
            <Field label="Celková plocha okien (m²)">
              <input
                name="windowArea"
                type="number"
                min="0"
                max="100000"
                step="0.1"
                defaultValue={room?.windowArea}
                placeholder="Napr. 14"
              />
            </Field>
            <small>
              Počet panelov nastavíš pri predmetoch. Z plochy okien ho
              neodhadujeme.
            </small>
            <div className="form-grid">
              {(
                [
                  ["curtains", "Závesy"],
                  ["blinds", "Žalúzie"],
                ] as const
              ).map(([field, label]) => (
                <Field label={label} key={field}>
                  <select
                    name={field}
                    defaultValue={
                      room?.[field] === undefined
                        ? ""
                        : room[field]
                          ? "yes"
                          : "no"
                    }
                  >
                    <option value="">Zatiaľ nezadané</option>
                    <option value="yes">Áno</option>
                    <option value="no">Nie</option>
                  </select>
                </Field>
              ))}
            </div>
            <small>
              Áno pridá predmet a malé úlohy. Nie pozastaví jeho úlohy; predmet
              ostane uložený.
            </small>
          </details>
          <Field label="Čistiace zóny (jedna na riadok)">
            <textarea name="zones" defaultValue={room?.zones.join("\n")} />
          </Field>
          <label className="check">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={room?.enabled ?? true}
            />
            Zahrnúť do pravidelného plánu
          </label>
          <PhotoInput value={room?.photo} />
          {formEnd}
        </form>
      </Dialog>
    );
  }
  if (modal.kind === "object") {
    const obj = s.objects.find((o) => o.id === modal.id);
    return (
      <Dialog
        title={obj ? "Upraviť predmet" : "Pridať predmet"}
        onClose={close}
      >
        <form
          onSubmit={handle(async (f) => {
            const photo = await photoFrom(f, "photo", obj?.photo);
            const category = str(f, "category") as ObjectCategory;
            const quantity = num(f, "quantity");
            await done((state) => {
              const value: Inventory = {
                id: obj?.id || uid(),
                householdId: hid,
                roomId: str(f, "roomId"),
                name: str(f, "name") || objectLabels[category],
                category,
                quantity: 1,
                dimensions: str(f, "dimensions"),
                area: num(f, "objectArea") || undefined,
                position:
                  (!obj || str(f, "roomId") === obj.roomId) &&
                  str(f, "position")
                    ? {
                        x: Number(str(f, "position").split(",")[0]),
                        y: Number(str(f, "position").split(",")[1]),
                      }
                    : undefined,
                surface: str(f, "surface"),
                accessibility: str(
                  f,
                  "accessibility",
                ) as Inventory["accessibility"],
                notes: str(f, "notes"),
                photo,
              };
              saveObject(state, value);
              for (let n = 1; n < quantity; n++)
                state.objects.push({
                  ...value,
                  id: uid(),
                  name: `${value.name} ${n + 1}`,
                });
              if (f.has("generate")) state.tasks.push(...generateTasks(state));
            });
          })}
        >
          <Field label="Názov">
            <input
              name="name"
              defaultValue={obj?.name}
              placeholder="Napr. Sklenený panel pri terase"
            />
          </Field>
          <Field
            label="Miestnosť predmetu"
            hint={
              obj
                ? "Pri presune do inej miestnosti sa presunú aj jeho úlohy. Polohu si nastavíš v novom náhľade."
                : undefined
            }
          >
            <select name="roomId" defaultValue={obj?.roomId || modal.roomId}>
              {s.rooms
                .filter((r) => r.householdId === hid)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {s.floors.find((floor) => floor.id === r.floorId)?.name} ·{" "}
                    {r.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Kategória">
              <select name="category" defaultValue={obj?.category || "custom"}>
                {Object.entries(objectLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Počet samostatných predmetov">
              <input
                name="quantity"
                type="number"
                min="1"
                max="30"
                defaultValue="1"
              />
            </Field>
          </div>
          <Field label="Rozmery (voliteľné)">
            <input
              name="dimensions"
              defaultValue={obj?.dimensions}
              placeholder="Napr. 80 × 150 cm"
            />
          </Field>
          <Field label="Materiál / povrch">
            <input name="surface" defaultValue={obj?.surface} />
          </Field>
          <div className="form-grid">
            <Field label="Plocha predmetu (m²)">
              <input
                type="number"
                name="objectArea"
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={obj?.area}
                placeholder="Voliteľné, napr. sklo"
              />
            </Field>
            <Field label="Poloha v náhľade">
              <select
                name="position"
                defaultValue={
                  obj?.position ? `${obj.position.x},${obj.position.y}` : ""
                }
              >
                <option value="">Automatické rozloženie</option>
                {[
                  [20, 20, "Vľavo hore"],
                  [50, 20, "V strede hore"],
                  [80, 20, "Vpravo hore"],
                  [20, 50, "Vľavo v strede"],
                  [50, 50, "V strede"],
                  [80, 50, "Vpravo v strede"],
                  [20, 80, "Vľavo dole"],
                  [50, 80, "V strede dole"],
                  [80, 80, "Vpravo dole"],
                ].map(([x, y, label]) => (
                  <option key={`${x},${y}`} value={`${x},${y}`}>
                    {label}
                  </option>
                ))}
                {obj?.position &&
                  (![20, 50, 80].includes(obj.position.x) ||
                    ![20, 50, 80].includes(obj.position.y)) && (
                    <option value={`${obj.position.x},${obj.position.y}`}>
                      Vlastná uložená poloha
                    </option>
                  )}
              </select>
            </Field>
          </div>
          <Field label="Prístupnosť">
            <select
              name="accessibility"
              defaultValue={obj?.accessibility || "safe"}
            >
              <option value="safe">Bezpečne dostupný zo zeme</option>
              <option value="unsafe">
                Vyžaduje odborníka / prácu vo výške
              </option>
            </select>
          </Field>
          <Field label="Poznámka">
            <textarea name="notes" defaultValue={obj?.notes} />
          </Field>
          <PhotoInput value={obj?.photo} />
          <label className="check">
            <input name="generate" type="checkbox" defaultChecked={!obj} />
            Pridať vhodné malé úlohy zo šablón
          </label>
          <small>
            Každý kus dostane vlastné úlohy. Pri nebezpečnom prístupe sa úlohy
            negenerujú.
          </small>
          {formEnd}
        </form>
      </Dialog>
    );
  }
  if (modal.kind === "problem") {
    const p = s.problems.find((p) => p.id === modal.id);
    return (
      <Dialog title={p ? "Upraviť nápad" : "Toto ma doma štve"} onClose={close}>
        <form
          onSubmit={handle(async (f) => {
            const photo = await photoFrom(f);
            const category = str(f, "category") as Problem["category"];
            const title = str(f, "title");
            const suggested = propose({ title, category });
            const steps = str(f, "steps").split("\n").filter(Boolean);
            const value: Problem = {
              id: p?.id || uid(),
              householdId: hid,
              roomId: str(f, "roomId"),
              objectId: str(f, "objectId") || undefined,
              title,
              description: str(f, "description"),
              category,
              priority: num(f, "priority"),
              status: str(f, "status") as Problem["status"],
              budgetCents: Math.round(num(f, "budget") * 100),
              notes: str(f, "notes"),
              solution: str(f, "solution") || p?.solution || "",
              steps: steps.map((title, i) => ({
                id: p?.steps[i]?.id || uid(),
                title,
                done: p?.steps[i]?.done || false,
                duration: 5,
              })),
              photos: photo ? [...(p?.photos || []), photo] : p?.photos || [],
              createdAt: p?.createdAt || new Date().toISOString(),
              completedAt:
                str(f, "status") === "Vyriešené"
                  ? p?.completedAt || new Date().toISOString()
                  : undefined,
            };
            if (f.has("suggest")) {
              value.solution = suggested.solution;
              value.steps = suggested.titles.map((title) => ({
                id: uid(),
                title,
                done: false,
                duration: 5,
              }));
            }
            await done((state) => {
              const i = state.problems.findIndex((x) => x.id === value.id);
              if (i < 0) state.problems.push(value);
              else state.problems[i] = value;
            });
          })}
        >
          <Field label="Čo ťa štve?">
            <input
              name="title"
              required
              maxLength={250}
              placeholder="V skrinke pri vchode je chaos."
              defaultValue={p?.title}
            />
          </Field>
          <div className="form-grid">
            <Field label="Miestnosť">
              <select name="roomId" defaultValue={p?.roomId || ""}>
                <option value="">Celá domácnosť</option>
                {s.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kategória">
              <select
                name="category"
                defaultValue={p?.category || "Zorganizovať"}
              >
                {[
                  "Zorganizovať",
                  "Opraviť",
                  "Vymeniť",
                  "Prerobiť",
                  "Vymyslieť riešenie",
                  "Dokončiť",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <details open={!!p}>
            <summary>Podrobnosti a riešenie</summary>
            <Field label="Predmet (voliteľné)">
              <select name="objectId" defaultValue={p?.objectId || ""}>
                <option value="">Bez predmetu</option>
                {s.objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {s.rooms.find((r) => r.id === o.roomId)?.name} · {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Popis">
              <textarea name="description" defaultValue={p?.description} />
            </Field>
            <div className="form-grid">
              <Field label="Stav">
                <select name="status" defaultValue={p?.status || "Nové"}>
                  {problemStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priorita">
                <select name="priority" defaultValue={p?.priority || 2}>
                  <option value="1">Nízka</option>
                  <option value="2">Bežná</option>
                  <option value="3">Vysoká</option>
                </select>
              </Field>
              <Field label="Rozpočet (€)">
                <input
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={(p?.budgetCents || 0) / 100}
                />
              </Field>
            </div>
            <Field label="Navrhované riešenie">
              <textarea name="solution" defaultValue={p?.solution} />
            </Field>
            <Field label="Malé kroky (jeden na riadok)">
              <textarea
                name="steps"
                defaultValue={p?.steps.map((st) => st.title).join("\n")}
              />
            </Field>
            <Field label="Poznámky">
              <textarea name="notes" defaultValue={p?.notes} />
            </Field>
            <PhotoInput />
            <label className="check">
              <input type="checkbox" name="suggest" />
              Navrhnúť jednoduché riešenie zo šablóny
            </label>
            <small>
              Návrhy používajú pripravené pravidlá. Riešenie si môžeš upraviť.
            </small>
          </details>
          <input
            name="status"
            type="hidden"
            value={p?.status || "Nové"}
            disabled={!!p}
          />
          {formEnd}
        </form>
      </Dialog>
    );
  }
  if (modal.kind === "split")
    return (
      <Dialog title="Rozdeliť na malé kroky" onClose={close}>
        <form
          onSubmit={handle(async (f) =>
            done((state) =>
              splitTask(
                state,
                modal.id,
                str(f, "steps").split("\n").filter(Boolean),
              ),
            ),
          )}
        >
          <p>
            Pôvodná úloha sa pozastaví. Zadaj aspoň dva konkrétne kroky, jeden
            na riadok.
          </p>
          <Field label="Malé samostatné úlohy">
            <textarea
              name="steps"
              required
              rows={5}
              placeholder={"Utrieť prvú policu\nUtrieť druhú policu"}
            />
          </Field>
          {formEnd}
        </form>
      </Dialog>
    );
  if (modal.kind === "delete")
    return (
      <Dialog title="Odstrániť záznam?" onClose={close}>
        <p>
          {modal.entity === "floor"
            ? "Miestnosti sa presunú na prvé zostávajúce podlažie. Samotné podlažie sa odstráni."
            : modal.entity === "room"
              ? "Odstráni sa miestnosť, jej predmety a úlohy."
              : "Záznam sa odstráni z knižnice."}{" "}
          História a už dohodnuté povinnosti v pláne zostanú zachované.
        </p>
        <div className="actions">
          <Button variant="secondary" onClick={close}>
            Ponechať
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              void done((state) => {
                if (modal.entity === "task") deleteTask(state, modal.id);
                if (modal.entity === "floor") {
                  const target = state.floors.find((f) => f.id !== modal.id);
                  if (!target)
                    throw new Error(
                      "Domácnosť potrebuje aspoň jedno podlažie.",
                    );
                  state.rooms.forEach((r) => {
                    if (r.floorId === modal.id) r.floorId = target.id;
                  });
                  state.floors = state.floors.filter((f) => f.id !== modal.id);
                }
                if (modal.entity === "wish")
                  state.wishes = state.wishes.filter((w) => w.id !== modal.id);
                if (modal.entity === "room") deleteRoom(state, modal.id);
                if (modal.entity === "object") {
                  state.objects = state.objects.filter(
                    (o) => o.id !== modal.id,
                  );
                  state.tasks = state.tasks.filter(
                    (t) => t.objectId !== modal.id,
                  );
                  state.problems.forEach((p) => {
                    if (p.objectId === modal.id) delete p.objectId;
                  });
                }
                if (modal.entity === "problem") {
                  state.problems = state.problems.filter(
                    (p) => p.id !== modal.id,
                  );
                  state.megas.forEach((m) => {
                    if (m.problemId === modal.id) delete m.problemId;
                  });
                }
              })
            }
          >
            Odstrániť
          </Button>
        </div>
      </Dialog>
    );
  if (modal.kind === "wish")
    return (
      <Dialog
        title={modal.id ? "Upraviť želanie" : "Nové želanie"}
        onClose={close}
      >
        <form
          onSubmit={handle(async (f) =>
            done((state) => {
              const existing = state.wishes.find((w) => w.id === modal.id);
              if (existing) {
                existing.title = str(f, "title");
                existing.cents = Math.round(num(f, "amount") * 100);
              } else
                state.wishes.push({
                  id: uid(),
                  householdId: hid,
                  title: str(f, "title"),
                  cents: Math.round(num(f, "amount") * 100),
                  redeemedCents: 0,
                });
            }),
          )}
        >
          <Field label="Na čo sa tešíš?">
            <input
              name="title"
              required
              defaultValue={s.wishes.find((w) => w.id === modal.id)?.title}
            />
          </Field>
          <Field label="Cieľová suma (€)">
            <input
              name="amount"
              defaultValue={
                s.wishes.find((w) => w.id === modal.id)?.cents
                  ? s.wishes.find((w) => w.id === modal.id)!.cents / 100
                  : undefined
              }
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          {formEnd}
        </form>
      </Dialog>
    );
  if (modal.kind === "redeem")
    return (
      <Dialog title="Využiť osobnú odmenu" onClose={close}>
        <form
          onSubmit={handle(async (f) =>
            done(
              (state) =>
                redeem(
                  state,
                  Math.round(num(f, "amount") * 100),
                  str(f, "title"),
                  modal.wishId,
                ),
              "Odmena je zaznamenaná.",
            ),
          )}
        >
          <p>
            Zaznamenáš vlastné využitie virtuálneho rozpočtu. Platba sa
            nevykonáva.
          </p>
          <Field label="Suma (€)">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          <Field label="Na čo si odmenu použila?">
            <input
              name="title"
              required
              defaultValue={s.wishes.find((w) => w.id === modal.wishId)?.title}
            />
          </Field>
          {formEnd}
        </form>
      </Dialog>
    );
  if (modal.kind === "household")
    return (
      <Dialog title="Moja domácnosť" onClose={close}>
        <form
          onSubmit={handle(async (f) =>
            done((state) => {
              state.households[0] = {
                ...state.households[0],
                name: str(f, "name"),
                type: str(f, "type") as "house" | "apartment",
                totalArea: num(f, "area"),
                residentCount: num(f, "residents"),
                children: f.has("children"),
                pets: f.has("pets"),
                timezone: str(f, "timezone"),
              };
              state.profiles[0].displayName = str(f, "displayName") || "Ty";
            }),
          )}
        >
          <Field label="Názov">
            <input name="name" required defaultValue={s.households[0].name} />
          </Field>
          <Field label="Tvoje meno">
            <input
              name="displayName"
              defaultValue={s.profiles[0].displayName}
            />
          </Field>
          <div className="form-grid">
            <Field label="Typ">
              <select name="type" defaultValue={s.households[0].type}>
                <option value="house">Dom</option>
                <option value="apartment">Byt</option>
              </select>
            </Field>
            <Field label="Rozloha v m²">
              <input
                name="area"
                type="number"
                min="0"
                defaultValue={s.households[0].totalArea}
              />
            </Field>
            <Field label="Obyvatelia">
              <input
                name="residents"
                type="number"
                min="1"
                max="100"
                defaultValue={s.households[0].residentCount}
              />
            </Field>
          </div>
          <label className="check">
            <input
              name="children"
              type="checkbox"
              defaultChecked={s.households[0].children}
            />
            Deti
          </label>
          <label className="check">
            <input
              name="pets"
              type="checkbox"
              defaultChecked={s.households[0].pets}
            />
            Zvieratá
          </label>
          <Field
            label="Časové pásmo"
            hint="Plány používajú dátum v tomto pásme aj počas cestovania."
          >
            <input
              name="timezone"
              required
              defaultValue={s.households[0].timezone}
            />
          </Field>
          {formEnd}
        </form>
      </Dialog>
    );
  return null;
}
function TaskForm({
  s,
  run,
  open,
  modal,
}: { modal: { kind: "task"; id?: string; roomId?: string } } & ScreenProps) {
  const task = s.tasks.find((t) => t.id === modal.id),
    [roomId, setRoomId] = useState(
      task?.roomId || modal.roomId || s.rooms[0]?.id || "",
    ),
    [error, setError] = useState(""),
    [unit, setUnit] = useState<Recurrence["unit"]>(
      task?.recurrence.unit || "week",
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const day = dayOf(s);
    const value: Task = {
      id: task?.id || uid(),
      householdId: s.households[0].id,
      roomId,
      objectId: str(f, "objectId") || undefined,
      templateId: task?.templateId,
      title: str(f, "title"),
      instructions: str(f, "instructions"),
      duration: num(f, "duration"),
      recurrence: {
        unit,
        interval: num(f, "interval"),
        strategy: str(f, "strategy") as Recurrence["strategy"],
        anchor: str(f, "anchor"),
        preferredDay:
          str(f, "preferredDay") === "" ? undefined : num(f, "preferredDay"),
      },
      priority: num(f, "priority"),
      energy: num(f, "energy"),
      difficulty: num(f, "difficulty"),
      supplies: str(f, "supplies")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      enabled: f.has("enabled"),
      nextDue: str(f, "nextDue") || day,
      lastCompleted: task?.lastCompleted,
      workflow: str(f, "workflow") === "wash" ? "wash" : undefined,
      eventAt: task?.eventAt,
      parentCompletionId: task?.parentCompletionId,
      acceptedLong: f.has("acceptedLong"),
    };
    if (await run((state) => saveTask(state, value), "Úloha je pripravená."))
      open(null);
    else setError("Skontroluj údaje úlohy.");
  };
  return (
    <Dialog
      title={task ? "Upraviť úlohu" : "Jedna malá úloha"}
      onClose={() => open(null)}
    >
      <form onSubmit={submit}>
        <p>Jeden viditeľný výsledok. Ideálne za 2–5 minút.</p>
        <Field label="Názov úlohy">
          <input
            name="title"
            required
            maxLength={250}
            defaultValue={task?.title}
            placeholder="Utrieť reproduktory zhora"
          />
        </Field>
        <div className="form-grid">
          <Field label="Miestnosť">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            >
              {s.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Predmet (voliteľné)">
            <select
              key={roomId}
              name="objectId"
              defaultValue={task?.objectId || ""}
            >
              <option value="">Bez predmetu</option>
              {s.objects
                .filter((o) => o.roomId === roomId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Trvanie (minúty)">
            <input
              name="duration"
              type="number"
              min="1"
              max="120"
              required
              defaultValue={task?.duration || 3}
            />
          </Field>
          <Field label="Prvá / ďalšia úloha">
            <input
              name="nextDue"
              type="date"
              required
              defaultValue={task?.nextDue || dayOf(s)}
            />
          </Field>
        </div>
        <Field label="Postup">
          <textarea
            name="instructions"
            defaultValue={task?.instructions}
            placeholder="Malý úsek a konkrétny výsledok…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Opakovanie">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Recurrence["unit"])}
            >
              <option value="day">Každých N dní</option>
              <option value="week">Každých N týždňov</option>
              <option value="month">Každých N mesiacov</option>
              <option value="year">Každých N rokov</option>
              <option value="once">Jednorazovo</option>
            </select>
          </Field>
          <Field label="Interval N">
            <input
              name="interval"
              type="number"
              required
              min="1"
              max="3660"
              defaultValue={task?.recurrence.interval || 1}
            />
          </Field>
          <Field label="Stratégia">
            <select
              name="strategy"
              defaultValue={task?.recurrence.strategy || "completion"}
            >
              <option value="completion">Od skutočného dokončenia</option>
              <option value="calendar">Pevný kalendár</option>
            </select>
          </Field>
          <Field label="Začiatok kalendára">
            <input
              type="date"
              name="anchor"
              required
              defaultValue={task?.recurrence.anchor || dayOf(s)}
            />
          </Field>
          <Field label="Preferovaný deň">
            <select
              name="preferredDay"
              defaultValue={task?.recurrence.preferredDay ?? ""}
            >
              <option value="">Bez preferencie</option>
              {[
                "Nedeľa",
                "Pondelok",
                "Utorok",
                "Streda",
                "Štvrtok",
                "Piatok",
                "Sobota",
              ].map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priorita">
            <select name="priority" defaultValue={task?.priority || 2}>
              <option value="1">Nízka</option>
              <option value="2">Bežná</option>
              <option value="3">Hygiena / vysoká</option>
            </select>
          </Field>
          <Field label="Potrebná energia">
            <select name="energy" defaultValue={task?.energy || 1}>
              <option value="1">Nízka</option>
              <option value="2">Stredná</option>
              <option value="3">Vyššia</option>
            </select>
          </Field>
          <Field label="Náročnosť">
            <select name="difficulty" defaultValue={task?.difficulty || 1}>
              <option value="1">Jednoduchá</option>
              <option value="2">Bežná</option>
              <option value="3">Náročnejšia</option>
            </select>
          </Field>
          <Field label="Pranie">
            <select name="workflow" defaultValue={task?.workflow || ""}>
              <option value="">Bežná úloha</option>
              <option value="wash">Spustenie práčky s pokračovaním</option>
            </select>
          </Field>
        </div>
        <Field label="Pomôcky (oddelené čiarkou)">
          <input name="supplies" defaultValue={task?.supplies.join(", ")} />
        </Field>
        <label className="check">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={task?.enabled ?? true}
          />
          Aktívna úloha
        </label>
        <label className="check">
          <input
            name="acceptedLong"
            type="checkbox"
            defaultChecked={task?.acceptedLong}
          />
          Výslovne povoľujem výnimku nad 10 minút
        </label>
        {error && <p className="error">{error}</p>}
        <Button type="submit" disabled={!roomId}>
          <Plus size={18} />
          {task ? "Uložiť zmeny" : "Pridať úlohu"}
        </Button>
      </form>
    </Dialog>
  );
}
