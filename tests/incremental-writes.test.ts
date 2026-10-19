import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { createDatabase, LocalRepository } from "../src/persistence/repository";
import { complete } from "../src/domain/commands";
import { tables, uid, type State } from "../src/domain/model";
import { fixture, now } from "./fixture";

const databases: Dexie[] = [];
const repository = () => {
  const db = createDatabase(`incremental-${uid()}`);
  databases.push(db);
  return new LocalRepository(db);
};
afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases) await db.delete();
  databases.length = 0;
});

const photo = (mark: string) => `data:image/png;base64,${btoa(`png-${mark}`)}`;

type WriteEvent = {
  table: string;
  op: "create" | "update" | "delete";
  key: string;
};
function trackWrites(db: Dexie) {
  const events: WriteEvent[] = [];
  for (const name of [...tables, "photos", "safety"]) {
    const table = db.table(name);
    table.hook("creating", function (key, obj: { id?: string }) {
      events.push({
        table: name,
        op: "create",
        key: String(obj?.id ?? key),
      });
    });
    table.hook("updating", function (_mods, key) {
      events.push({ table: name, op: "update", key: String(key) });
    });
    table.hook("deleting", function (key) {
      events.push({ table: name, op: "delete", key: String(key) });
    });
  }
  return events;
}
function keys(events: WriteEvent[], table: string, op?: WriteEvent["op"]) {
  return events
    .filter((event) => event.table === table && (!op || event.op === op))
    .map((event) => event.key);
}

function withPhotos(s: State) {
  s.rooms[0].photo = photo("room");
  s.objects[0].photo = photo("object");
  s.wishes = [
    {
      id: "wish-keep",
      householdId: s.households[0].id,
      title: "Káva",
      cents: 100,
      redeemedCents: 0,
    },
    {
      id: "wish-drop",
      householdId: s.households[0].id,
      title: "Čaj",
      cents: 80,
      redeemedCents: 0,
    },
  ];
  return s;
}

describe("per-record command writes", () => {
  it("does not rewrite unchanged rows or photo blobs", async () => {
    const repo = repository(),
      s = withPhotos(fixture());
    await repo.replace(s);
    const events = trackWrites(repo.db),
      roomId = s.rooms[0].id,
      beforePhotos = await repo.db.table("photos").toArray();
    await repo.transact((state) => {
      state.rooms[0].name = "Preimenovaná obývačka";
    });
    expect(keys(events, "photos")).toEqual([]);
    expect(keys(events, "rooms")).toEqual([roomId]);
    expect(keys(events, "rooms", "update")).toEqual([roomId]);
    expect(keys(events, "tasks")).toEqual([]);
    expect(keys(events, "completions")).toEqual([]);
    expect(keys(events, "objects")).toEqual([]);
    expect(keys(events, "wishes")).toEqual([]);
    expect(keys(events, "safety", "update")).toEqual(["local"]);
    expect(await repo.db.table("photos").toArray()).toEqual(beforePhotos);
    expect((await repo.read()).rooms[0].name).toBe("Preimenovaná obývačka");
    expect((await repo.read()).rooms[0].photo).toBe(photo("room"));
  });

  it("rewrites only the photo whose bytes changed", async () => {
    const repo = repository(),
      s = withPhotos(fixture());
    await repo.replace(s);
    const events = trackWrites(repo.db),
      roomPhoto = `rooms:${s.rooms[0].id}:photo`,
      objectPhoto = `objects:${s.objects[0].id}:photo`;
    await repo.transact((state) => {
      state.rooms[0].photo = photo("replacement");
    });
    expect(keys(events, "photos")).toEqual([roomPhoto]);
    expect(keys(events, "photos", "update")).toEqual([roomPhoto]);
    expect(keys(events, "objects")).toEqual([]);
    expect(keys(events, "rooms")).toEqual([]);
    const saved = await repo.db.table("photos").toArray();
    expect(saved.map((item: { id: string }) => item.id).sort()).toEqual(
      [objectPhoto, roomPhoto].sort(),
    );
    expect((await repo.read()).rooms[0].photo).toBe(photo("replacement"));
    expect((await repo.read()).objects[0].photo).toBe(photo("object"));
  });

  it("deletes one row and one photo without rewriting the rest", async () => {
    const repo = repository(),
      s = withPhotos(fixture());
    await repo.replace(s);
    const events = trackWrites(repo.db),
      roomPhoto = `rooms:${s.rooms[0].id}:photo`;
    await repo.transact((state) => {
      delete state.rooms[0].photo;
      state.wishes = state.wishes.filter((wish) => wish.id === "wish-keep");
    });
    expect(keys(events, "photos", "delete")).toEqual([roomPhoto]);
    expect(keys(events, "photos", "create")).toEqual([]);
    expect(keys(events, "photos", "update")).toEqual([]);
    expect(keys(events, "wishes", "delete")).toEqual(["wish-drop"]);
    expect(keys(events, "wishes", "update")).toEqual([]);
    expect(keys(events, "rooms", "update")).toEqual([s.rooms[0].id]);
    expect(keys(events, "objects")).toEqual([]);
    expect(keys(events, "tasks")).toEqual([]);
    const saved = await repo.read();
    expect(saved.rooms[0].photo).toBeUndefined();
    expect(saved.wishes.map((wish) => wish.id)).toEqual(["wish-keep"]);
    expect(saved.objects[0].photo).toBe(photo("object"));
  });

  it("an unchanged command writes nothing", async () => {
    const repo = repository();
    await repo.replace(withPhotos(fixture()));
    const events = trackWrites(repo.db);
    await repo.transact(() => {});
    expect(events).toEqual([]);
  });

  it("a failure after an earlier put rolls the whole command back", async () => {
    const repo = repository(),
      s = withPhotos(fixture());
    await repo.replace(s);
    const before = await repo.readSnapshot();
    let roomsUpdated = 0;
    repo.db.table("rooms").hook("updating", () => {
      roomsUpdated += 1;
    });
    repo.db.table("completions").hook("creating", () => {
      throw new Error("simulated mid-command failure");
    });
    await expect(
      repo.transact((state) => {
        state.rooms[0].name = "Dočasný názov";
        const occurrence = state.weeks[0].required[0];
        complete(state, occurrence.taskId, "required", occurrence.id, now);
      }),
    ).rejects.toThrow("simulated mid-command failure");
    expect(roomsUpdated).toBe(1);
    expect(await repo.readSnapshot()).toEqual(before);
    expect(await repo.db.table("photos").count()).toBe(2);
    expect((await repo.read()).completions).toEqual([]);
  });

  it("swaps unique daily-plan dates without rewriting unrelated rows", async () => {
    const repo = repository(),
      s = withPhotos(fixture(false));
    const plan = (date: string) => ({
      id: `day-${date}`,
      householdId: s.households[0].id,
      date,
      occurrences: [],
      timeBudget: 10 as const,
      lockedAt: `${date}T12:00:00.000Z`,
    });
    s.dailyPlans = [plan("2026-10-01"), plan("2026-10-02")];
    await repo.replace(s);
    const events = trackWrites(repo.db);
    await repo.transact((state) => {
      const [first, second] = state.dailyPlans;
      const date = first.date;
      first.date = second.date;
      second.date = date;
    });
    const saved = await repo.read();
    expect(saved.dailyPlans.find((item) => item.id === "day-2026-10-01")?.date).toBe(
      "2026-10-02",
    );
    expect(saved.dailyPlans.find((item) => item.id === "day-2026-10-02")?.date).toBe(
      "2026-10-01",
    );
    expect(keys(events, "photos")).toEqual([]);
    expect(keys(events, "rooms")).toEqual([]);
    expect(keys(events, "tasks")).toEqual([]);
    expect(new Set(keys(events, "dailyPlans"))).toEqual(
      new Set(["day-2026-10-01", "day-2026-10-02"]),
    );
  });
});
