import { useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Pause,
  Play,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
  Undo2,
  ChevronRight,
  MapPin,
  Move,
  ArrowRightLeft,
} from "lucide-react";
import { type Task, type State, uid } from "../domain/model";
import {
  dayOf,
  complete,
  undo,
  postpone,
  replaceOccurrence,
  duplicateTask,
  plannedFor,
} from "../domain/commands";
import { completedIds, currentTasks, dailySession } from "../domain/scheduler";
import { shiftDay, recurrenceLabel } from "../domain/calendar";
import { Button, Empty, PageHead, type ScreenProps } from "./components";
import { generateTasks } from "../data/templates";
import {
  HouseholdMap,
  RoomScene,
  RoomDetails,
  RoomIcon,
  ObjectIcon,
} from "./RoomVisual";
const tabs = [
  ["today", "Dnes"],
  ["rooms", "Miestnosti"],
  ["library", "Knižnica"],
  ["upcoming", "Plán"],
  ["laundry", "Pranie"],
  ["history", "História"],
];
export default function Tasks({ s, run, open }: ScreenProps) {
  const [tab, setTab] = useState(
      new URLSearchParams(location.hash.split("?")[1]).get("tab") === "rooms"
        ? "rooms"
        : "today",
    ),
    [roomId, setRoomId] = useState(""),
    [search, setSearch] = useState(""),
    [cycle, setCycle] = useState(60),
    day = dayOf(s),
    ids = completedIds(s),
    selected = s.rooms.find((r) => r.id === roomId);
  const list = s.tasks.filter(
    (t) =>
      (!roomId || t.roomId === roomId) &&
      t.title
        .toLocaleLowerCase("sk")
        .includes(search.toLocaleLowerCase("sk")) &&
      (tab !== "laundry" ||
        !!t.workflow ||
        !!t.eventAt ||
        s.objects.some(
          (o) =>
            o.id === t.objectId && ["washer", "dryer"].includes(o.category),
        )),
  );
  const taskList = (tasks: Task[]) =>
    tasks.length ? (
      <div className="task-list">
        {tasks.map((t) => (
          <article
            className={`task-row ${!t.enabled ? "paused" : ""}`}
            key={t.id}
          >
            <span className="task-icon">
              <ObjectIcon
                category={
                  s.objects.find((o) => o.id === t.objectId)?.category ||
                  "custom"
                }
              />
            </span>
            <div className="task-row-content">
              <span className="task-location">
                {s.rooms.find((r) => r.id === t.roomId)?.name}
                {t.objectId &&
                  ` · ${s.objects.find((o) => o.id === t.objectId)?.name || ""}`}
              </span>
              <h3>{t.title}</h3>
              <div className="task-meta">
                <span>
                  <Clock size={14} />
                  {t.duration} min
                </span>
                <span>
                  {t.enabled ? "Najbližšie: " + t.nextDue : "Pozastavená"}
                </span>
                <span>
                  <RefreshCw size={13} />
                  {recurrenceLabel(t.recurrence)}
                </span>
                {t.eventAt && (
                  <span>
                    Po cykle: {new Date(t.eventAt).toLocaleString("sk-SK")}
                  </span>
                )}
              </div>
            </div>
            <details className="task-actions">
              <summary aria-label={`Možnosti: ${t.title}`}>•••</summary>
              <div>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "location", taskId: t.id })}
                >
                  <MapPin size={16} />
                  Ukázať miesto
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "task", id: t.id })}
                >
                  <Pencil size={16} />
                  Upraviť
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void run(
                      (state) => duplicateTask(state, t.id),
                      "Vytvorená kópia.",
                    )
                  }
                >
                  <Copy size={16} />
                  Duplikovať
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void run((state) => {
                      const task = state.tasks.find((x) => x.id === t.id);
                      if (task) task.enabled = !task.enabled;
                    })
                  }
                >
                  {t.enabled ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {t.enabled ? "Pozastaviť" : "Aktivovať"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "split", id: t.id })}
                >
                  <Scissors size={16} />
                  Rozdeliť
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    open({ kind: "delete", entity: "task", id: t.id })
                  }
                >
                  <Trash2 size={16} />
                  Odstrániť
                </Button>
                {t.enabled && t.nextDue <= day && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void run(
                        (state) =>
                          complete(
                            state,
                            t.id,
                            "manual",
                            undefined,
                            new Date(),
                            cycle,
                          ),
                        "Malý krok je hotový.",
                      )
                    }
                  >
                    <Check size={16} />
                    Dokončiť teraz
                  </Button>
                )}
              </div>
            </details>
          </article>
        ))}
      </div>
    ) : (
      <Empty
        title="Miesto pre tvoju prvú úlohu."
        text="Stačí jedna konkrétna vec, ktorú zvládneš za pár minút."
        action={
          <Button
            onClick={() => open({ kind: "task", roomId: roomId || undefined })}
          >
            <Plus size={18} />
            Pridať úlohu
          </Button>
        }
      />
    );
  return (
    <>
      <PageHead
        eyebrow="MALÉ ÚLOHY, VIDITEĽNÝ VÝSLEDOK"
        title="Tvoj domov v rytme."
        text="Všetko má svoje miesto. Aj čas na oddych."
        action={
          <Button
            onClick={() => open({ kind: "task", roomId: roomId || undefined })}
          >
            <Plus size={18} />
            Pridať úlohu
          </Button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Zobrazenie úloh">
        {tabs.map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setRoomId("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "today" && (
        <>
          <div className="section-heading">
            <h2>Dnešný plán</h2>
            <span className="muted">
              {s.dailyPlans.find((p) => p.date === day)?.timeBudget} min ·
              vlastným tempom
            </span>
          </div>
          {plannedFor(s, day).length || currentTasks(s, day).length ? (
            <div className="task-list">
              {[
                ...dailySession(
                  s,
                  day,
                  s.dailyPlans.find((p) => p.date === day)?.timeBudget,
                ),
                ...plannedFor(s, day).filter(
                  (o) =>
                    ids.has(o.id) ||
                    o.status === "skipped" ||
                    (!!o.deferredTo && o.deferredTo > day),
                ),
              ].map((o) => (
                <article
                  key={o.id}
                  className={`task-row ${ids.has(o.id) ? "completed" : ""}`}
                >
                  <Button
                    variant={`icon ${ids.has(o.id) ? "secondary" : "ghost"}`}
                    aria-label={`Dokončiť: ${o.title}`}
                    disabled={
                      ids.has(o.id) || (!!o.deferredTo && o.deferredTo > day)
                    }
                    onClick={() =>
                      void run(
                        (state) =>
                          complete(
                            state,
                            o.taskId,
                            "required",
                            o.id,
                            new Date(),
                            cycle,
                          ),
                        `Hotovo. +${o.xp} DA ⚡`,
                      )
                    }
                  >
                    <Check size={20} />
                  </Button>
                  <div className="task-row-content">
                    <span className="task-location">{o.roomName}</span>
                    <h3>{o.title}</h3>
                    <div className="task-meta">
                      <span>{o.duration} min</span>
                      <span>+{o.xp} DA ⚡</span>
                      {o.deferredTo && <span>Odložené na {o.deferredTo}</span>}
                      {o.status === "skipped" && (
                        <span>Vynechané · stále patrí do týždňa</span>
                      )}
                    </div>
                  </div>
                  {!ids.has(o.id) && (
                    <details className="task-actions">
                      <summary aria-label={`Možnosti: ${o.title}`}>•••</summary>
                      <div>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            open({
                              kind: "location",
                              taskId: o.taskId,
                              occurrenceId: o.id,
                            })
                          }
                        >
                          <MapPin size={16} />
                          Ukázať miesto
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void run(
                              (state) =>
                                postpone(state, o.id, shiftDay(day, 1)),
                              "Úloha počká do zajtra.",
                            )
                          }
                        >
                          Odložiť na zajtra
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void run(
                              (state) => replaceOccurrence(state, o.id, day),
                              "Úloha bola nahradená.",
                            )
                          }
                        >
                          <RefreshCw size={16} />
                          Nahradiť
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void run((state) => {
                              const item = state.dailyPlans
                                .flatMap((p) => p.occurrences)
                                .find((x) => x.id === o.id);
                              if (item)
                                item.status =
                                  item.status === "skipped"
                                    ? "pending"
                                    : "skipped";
                            }, "Stav úlohy bol zmenený.")
                          }
                        >
                          {o.status === "skipped"
                            ? "Vrátiť do plánu"
                            : "Vynechať dnes"}
                        </Button>
                        {s.tasks.some((t) => t.id === o.taskId) && (
                          <Button
                            variant="ghost"
                            onClick={() => open({ kind: "task", id: o.taskId })}
                          >
                            Upraviť budúce opakovanie
                          </Button>
                        )}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Dnes máš priestor na oddych."
              text="Nemáš žiadne povinné úlohy. Aj pokoj patrí k domovu."
            />
          )}
          <label className="cycle-input">
            Pri spustení práčky: dĺžka cyklu{" "}
            <input
              aria-label="Dĺžka pracieho cyklu"
              type="number"
              min="1"
              max="600"
              value={cycle}
              onChange={(e) => setCycle(Number(e.target.value))}
            />{" "}
            min
          </label>
        </>
      )}
      {tab === "rooms" &&
        (selected ? (
          <>
            <Button variant="ghost" onClick={() => setRoomId("")}>
              ← Všetky miestnosti
            </Button>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {s.floors.find((f) => f.id === selected.floorId)?.name}
                </span>
                <h2>{selected.name}</h2>
              </div>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() => open({ kind: "room", id: selected.id })}
                >
                  <Pencil size={16} />
                  Upraviť
                </Button>
                <Button
                  onClick={() => open({ kind: "task", roomId: selected.id })}
                >
                  <Plus size={17} />
                  Pridať úlohu
                </Button>
              </div>
            </div>
            <div className="room-overview card">
              <div>
                {selected.photo ? (
                  <img
                    className="room-photo"
                    src={selected.photo}
                    alt={selected.name}
                  />
                ) : (
                  <RoomScene room={selected} objects={s.objects} />
                )}
                <Button
                  variant="secondary"
                  className="layout-open"
                  onClick={() => open({ kind: "layout", roomId: selected.id })}
                >
                  <Move size={17} />
                  Presúvať predmety
                </Button>
              </div>
              <div>
                <span className="room-icon-tile">
                  <RoomIcon category={selected.category} size={28} />
                </span>
                <h3>Tvoja miestnosť, tvoje detaily</h3>
                <RoomDetails room={selected} />
                <p>
                  Nastav povrchy a vybavenie. Každý predmet môže mať vlastné
                  malé úlohy a frekvenciu.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => open({ kind: "room", id: selected.id })}
                >
                  <Pencil size={16} />
                  Rozloha, okná a povrchy
                </Button>
              </div>
            </div>
            {selected.photo && (
              <details className="spaced">
                <summary>Schematický náhľad vybavenia</summary>
                <RoomScene room={selected} objects={s.objects} />
              </details>
            )}
            <div className="zone-tags">
              {selected.zones.map((z) => (
                <span className="tag" key={z}>
                  {z}
                </span>
              ))}
            </div>
            <section className="card">
              <div className="section-heading">
                <h3>Predmety a spotrebiče</h3>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "object", roomId: selected.id })}
                >
                  <Plus size={17} />
                  Pridať predmet
                </Button>
              </div>
              {s.objects
                .filter((o) => o.roomId === roomId)
                .map((o) => (
                  <div className="inventory-row" key={o.id}>
                    {o.photo ? (
                      <img
                        src={o.photo}
                        className="inventory-photo"
                        alt={o.name}
                      />
                    ) : (
                      <span className="room-icon-tile small">
                        <ObjectIcon category={o.category} />
                      </span>
                    )}
                    <div>
                      <strong>{o.name}</strong>
                      <small>
                        {o.dimensions} {o.surface} {o.area && ` · ${o.area} m²`}
                        {o.accessibility === "unsafe" && "· odborná údržba"}
                      </small>
                      <small>
                        {s.tasks.filter((t) => t.objectId === o.id).length} úloh
                        · frekvencie nižšie
                      </small>
                    </div>
                    <div className="actions">
                      <Button
                        variant="icon ghost"
                        aria-label={`Presunúť predmet ${o.name} do inej miestnosti`}
                        onClick={() => open({ kind: "move-object", id: o.id })}
                      >
                        <ArrowRightLeft size={16} />
                      </Button>
                      <Button
                        variant="icon ghost"
                        aria-label={`Upraviť predmet ${o.name}`}
                        onClick={() =>
                          open({ kind: "object", roomId, id: o.id })
                        }
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="icon ghost"
                        aria-label={`Odstrániť predmet ${o.name}`}
                        onClick={() =>
                          open({ kind: "delete", entity: "object", id: o.id })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              <Button
                variant="secondary"
                onClick={() =>
                  void run(
                    (state) => state.tasks.push(...generateTasks(state)),
                    "Doplnené relevantné úlohy bez duplicít.",
                  )
                }
              >
                Doplniť vhodné šablóny
              </Button>
            </section>
            <h3 className="spaced">Malé úlohy v miestnosti</h3>
            {taskList(list)}
          </>
        ) : (
          <>
            <div className="section-heading">
              <h2>Miestnosti</h2>
              <Button
                variant="secondary"
                onClick={() => open({ kind: "room" })}
              >
                <Plus size={18} />
                Pridať miestnosť
              </Button>
            </div>
            <section className="card spaced">
              <HouseholdMap s={s} onSelect={setRoomId} />
            </section>
            <div className="room-grid">
              {[...s.rooms]
                .sort((a, b) => a.order - b.order)
                .map((r) => (
                  <article className="card room-card" key={r.id}>
                    <button
                      className="room-open"
                      onClick={() => setRoomId(r.id)}
                    >
                      <div className="room-card-art" aria-hidden="true">
                        {r.photo ? (
                          <img src={r.photo} alt="" />
                        ) : (
                          <RoomScene room={r} objects={s.objects} thumbnail />
                        )}
                      </div>
                      <span className="eyebrow">
                        {s.floors.find((f) => f.id === r.floorId)?.name}
                      </span>
                      <h3>
                        <RoomIcon category={r.category} size={19} />
                        {r.name}
                        <ChevronRight size={18} />
                      </h3>
                      <p>
                        {s.tasks.filter((t) => t.roomId === r.id).length} malých
                        úloh · {r.enabled ? "Aktívna" : "Pozastavená"}
                      </p>
                      <RoomDetails room={r} />
                    </button>
                    <Button
                      variant="ghost"
                      onClick={() => open({ kind: "task", roomId: r.id })}
                    >
                      <Plus size={16} />
                      Pridať úlohu
                    </Button>
                    <details>
                      <summary>Spravovať miestnosť</summary>
                      <div className="actions">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void run(
                              (state) => duplicateRoom(state, r.id, day),
                              "Miestnosť bola duplikovaná.",
                            )
                          }
                        >
                          <Copy size={16} />
                          Kópia
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void run((state) => {
                              const sorted = [...state.rooms].sort(
                                  (a, b) => a.order - b.order,
                                ),
                                i = sorted.findIndex((x) => x.id === r.id);
                              if (i > 0)
                                [sorted[i].order, sorted[i - 1].order] = [
                                  sorted[i - 1].order,
                                  sorted[i].order,
                                ];
                            })
                          }
                        >
                          Posunúť vyššie
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            open({ kind: "delete", entity: "room", id: r.id })
                          }
                        >
                          <Trash2 size={16} />
                          Odstrániť
                        </Button>
                      </div>
                    </details>
                  </article>
                ))}
            </div>
          </>
        ))}
      {(tab === "library" || tab === "laundry") && (
        <>
          <div className="filter-row">
            <input
              type="search"
              aria-label="Hľadať úlohu"
              placeholder="Hľadať malú úlohu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filtrovať miestnosť"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Všetky miestnosti</option>
              {s.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {tab === "laundry" && (
            <div className="quiet-note">
              Dĺžka pracieho cyklu:{" "}
              <input
                type="number"
                min="1"
                max="600"
                value={cycle}
                aria-label="Dĺžka cyklu prania"
                onChange={(e) => setCycle(Number(e.target.value))}
              />{" "}
              min. Po skutočnom spustení vznikne jedna nadväzujúca úloha.
              Upozornenia fungujú pri otvorenej aplikácii.
            </div>
          )}
          {taskList(list)}
        </>
      )}
      {tab === "upcoming" && (
        <>
          {s.dailyPlans
            .filter((p) => p.date >= day)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((p) => (
              <section className="card spaced" key={p.id}>
                <div className="section-heading">
                  <h3>{p.date}</h3>
                  <span className="muted">{p.timeBudget} min</span>
                </div>
                {p.occurrences.map((o) => (
                  <div key={o.id} className="inventory-row">
                    <span>
                      {o.title}
                      <small>{o.roomName}</small>
                    </span>
                    <span>
                      {ids.has(o.id) ? "Hotovo" : `${o.duration} min`}
                    </span>
                    <Button
                      variant="icon ghost"
                      aria-label={`Ukázať miesto: ${o.title}`}
                      onClick={() =>
                        open({
                          kind: "location",
                          taskId: o.taskId,
                          occurrenceId: o.id,
                        })
                      }
                    >
                      <MapPin size={17} />
                    </Button>
                  </div>
                ))}
                {!p.occurrences.length && <p>Deň voľna alebo prázdny plán.</p>}
              </section>
            ))}
          <p className="quiet-note">
            Plán je dohodnutý na celý týždeň. Nové úlohy a nastavenia sa
            zohľadnia v ďalšom pláne; novú úlohu môžeš dokončiť aj z knižnice.
          </p>
        </>
      )}
      {tab === "history" &&
        (s.completions.length ? (
          <div className="task-list">
            {[...s.completions].reverse().map((c) => (
              <article
                key={c.id}
                className={`task-row ${c.undone ? "paused" : ""}`}
              >
                <div className="task-row-content">
                  <span className="task-location">
                    {c.roomName} ·{" "}
                    {new Date(c.completedAt).toLocaleString("sk-SK")}
                  </span>
                  <h3>{c.title}</h3>
                  <span className="muted">
                    {c.undone
                      ? "Vrátené"
                      : c.type === "extra"
                        ? "Extra krok · bez odmeny"
                        : `+${c.xp} DA ⚡`}
                  </span>
                </div>
                {!c.undone && (
                  <Button
                    variant="icon ghost"
                    aria-label={`Vrátiť dokončenie ${c.title}`}
                    onClick={() =>
                      void run(
                        (state) => undo(state, c.id),
                        "Dokončenie a odmeny boli opravené.",
                      )
                    }
                  >
                    <Undo2 size={18} />
                  </Button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Prvý krok je pred tebou."
            text="Tvoje dokončené úlohy sa objavia tu."
          />
        ))}
    </>
  );
}
export function duplicateRoom(s: State, id: string, day: string) {
  const room = s.rooms.find((r) => r.id === id);
  if (!room) return;
  const newId = uid(),
    map = new Map<string, string>();
  s.rooms.push({
    ...structuredClone(room),
    id: newId,
    name: room.name + " (kópia)",
    order: s.rooms.length,
  });
  const objects = s.objects
    .filter((o) => o.roomId === id)
    .map((o) => {
      const key = uid();
      map.set(o.id, key);
      return { ...structuredClone(o), id: key, roomId: newId };
    });
  s.objects.push(...objects);
  s.tasks.push(
    ...s.tasks
      .filter((t) => t.roomId === id)
      .map((t) => ({
        ...structuredClone(t),
        id: uid(),
        roomId: newId,
        objectId: t.objectId ? map.get(t.objectId) : undefined,
        nextDue: day,
        lastCompleted: undefined,
        parentCompletionId: undefined,
        eventAt: undefined,
      })),
  );
}
