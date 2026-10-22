import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import {
  canonicalState,
  createDatabase,
  LocalRepository,
  subscribeUpgrade,
} from "../src/persistence/repository";
import { tables, uid, type Occurrence, type State } from "../src/domain/model";
import { photoUrl, type StoredPhoto } from "../src/persistence/photos";
import { taskTier } from "../src/domain/tiers";
import { missingBasicTasks } from "../src/data/templates";
const databases: Dexie[] = [];
afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases) await db.delete();
  databases.length = 0;
});
function raster(
  mime: StoredPhoto["mime"],
  seed: number,
): StoredPhoto & { url: string } {
  const bytes = Uint8Array.from([
    137,
    80,
    78,
    seed,
    13,
    10,
    26,
    10,
    seed + 3,
    255,
  ]);
  return { id: "", mime, bytes, url: photoUrl({ mime, bytes }) };
}
function occurrence(
  id: string,
  taskId: string,
  roomId: string,
  roomName: string,
  patch: Partial<Occurrence> = {},
): Occurrence {
  return {
    id,
    taskId,
    roomId,
    roomName,
    title: "Utrieť jednu poličku",
    instructions: "Iba predná hrana.",
    duration: 3,
    xp: 10,
    date: "2026-10-05",
    status: "pending",
    ...patch,
  };
}
function strip<T>(value: T, keys: string[]): T {
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy as T;
}
function representative(version: 1 | 2 | 3 | 4) {
  const images = {
    room: raster("image/png", 11),
    object: raster("image/jpeg", 21),
    problemA: raster("image/webp", 31),
    problemB: raster("image/png", 41),
    before: raster("image/jpeg", 51),
    after: raster("image/webp", 61),
  };
  const householdId = "home-1";
  const expected: State = {
    profiles: [
      {
        id: "profile-1",
        displayName: "Patricia",
        createdAt: "2026-04-01T12:00:00.000Z",
      },
    ],
    households: [
      {
        id: householdId,
        name: "Byt na Mierovej",
        type: "apartment",
        totalArea: 72.5,
        residentCount: 2,
        children: false,
        pets: true,
        timezone: version === 1 ? "Europe/Bratislava" : "Europe/Vienna",
        createdAt: "2026-04-01T12:00:00.000Z",
      },
    ],
    floors: [{ id: "floor-1", householdId, name: "Prízemie", order: 0 }],
    rooms: [
      {
        id: "room-living",
        householdId,
        floorId: "floor-1",
        name: "Obývačka",
        category: "living",
        area: 22,
        flooring: "wood",
        floorSurfaces: [
          { material: "wood", area: 18 },
          { material: "carpet", area: 4 },
        ],
        width: 4.2,
        length: 5.1,
        windowArea: 3.5,
        curtains: true,
        blinds: false,
        order: 0,
        enabled: true,
        zones: ["okno"],
        photo: images.room.url,
      },
      {
        id: "room-kitchen",
        householdId,
        floorId: "floor-1",
        name: "Kuchyňa",
        category: "kitchen",
        flooring: "tile",
        order: 1,
        enabled: true,
        zones: [],
      },
    ],
    objects: [
      {
        id: "object-floor",
        householdId,
        roomId: "room-living",
        name: "Dubová podlaha",
        category: "floor",
        quantity: 1,
        dimensions: "4.2×5.1 m",
        area: 22,
        position: { x: 40, y: 62 },
        surface: "drevo",
        accessibility: "safe",
        photo: images.object.url,
        notes: "Nepremývať na mokro.",
      },
      {
        id: "object-fridge",
        householdId,
        roomId: "room-kitchen",
        name: "Chladnička",
        category: "fridge",
        quantity: 1,
        dimensions: "",
        surface: "",
        accessibility: "safe",
        notes: "",
      },
    ],
    tasks: [
      {
        id: "task-long",
        householdId,
        roomId: "room-living",
        objectId: "object-floor",
        title: "Pozbierať veci z podlahy",
        instructions: "Iba stred miestnosti.",
        duration: 15,
        recurrence: {
          unit: "week",
          interval: 1,
          strategy: "completion",
          anchor: "2026-04-06",
        },
        priority: 2,
        energy: 2,
        supplies: ["kôš"],
        enabled: true,
        nextDue: "2026-10-05",
        acceptedLong: true,
      },
      {
        id: "task-mismatch",
        householdId,
        roomId: "room-living",
        objectId: "object-fridge",
        title: "Utrieť dvierka",
        instructions: "Predná strana.",
        duration: 3,
        recurrence: {
          unit: "week",
          interval: 1,
          strategy: "calendar",
          anchor: "2026-04-06",
        },
        priority: 1,
        energy: 1,
        supplies: [],
        enabled: true,
        nextDue: "2026-10-05",
        acceptedLong: false,
      },
      {
        id: "task-plain",
        householdId,
        roomId: "room-living",
        title: "Preložiť pranie",
        instructions: "Jedna várka.",
        duration: 5,
        recurrence: {
          unit: "day",
          interval: 1,
          strategy: "completion",
          anchor: "2026-10-01",
        },
        priority: 3,
        energy: 1,
        supplies: [],
        enabled: true,
        nextDue: "2026-10-05",
        workflow: "wash",
        eventAt: "2026-10-05T18:30:00.000Z",
        parentCompletionId: "completion-done",
        acceptedLong: false,
      },
    ],
    completions: [
      {
        id: "completion-done",
        householdId,
        taskId: "task-plain",
        occurrenceId: "occ-plain",
        title: "Preložiť pranie",
        roomName: "Obývačka",
        duration: 5,
        completedAt: "2026-10-04T16:00:00.000Z",
        day: "2026-10-04",
        type: "required",
        xp: 20,
        previousDue: "2026-10-04",
        nextDue: "2026-10-05",
        undone: false,
      },
      {
        id: "completion-undo",
        householdId,
        taskId: "task-long",
        occurrenceId: "occ-historical",
        title: "Pozbierať veci z podlahy",
        roomName: "Obývačka",
        duration: 15,
        completedAt: "2026-09-28T15:00:00.000Z",
        day: "2026-09-28",
        type: "required",
        xp: 50,
        previousDue: "2026-09-28",
        nextDue: "2026-10-05",
        undone: true,
      },
    ],
    dailyPlans: [
      {
        id: "plan-today",
        householdId,
        date: "2026-10-05",
        timeBudget: 15,
        lockedAt: "2026-10-05T06:00:00.000Z",
        occurrences: [
          occurrence("occ-backfill", "task-long", "room-living", "Obývačka", {
            objectId: "object-floor",
            objectName: "Dubová podlaha",
            duration: 15,
            xp: 50,
            title: "Pozbierať veci z podlahy",
          }),
          occurrence("occ-historical", "task-long", "room-living", "Obývačka", {
            objectId: "object-floor",
            objectName: "Starý názov",
            duration: 15,
            xp: 50,
            title: "Pozbierať veci z podlahy",
            status: "skipped",
            deferredTo: "2026-10-06",
          }),
          occurrence(
            "occ-mismatch",
            "task-mismatch",
            "room-living",
            "Obývačka",
            {
              title: "Utrieť dvierka",
            },
          ),
          occurrence("occ-plain", "task-plain", "room-living", "Obývačka", {
            title: "Preložiť pranie",
            duration: 5,
            xp: 20,
          }),
        ],
      },
    ],
    weeks: [
      {
        id: "week-current",
        householdId,
        start: "2026-10-05",
        end: "2026-10-11",
        rewardCents: 2000,
        rewardEnabled: true,
        restDays: [0, 6],
        lockedAt: "2026-10-05T06:00:00.000Z",
        required: [
          occurrence(
            "occ-week-backfill",
            "task-long",
            "room-living",
            "Obývačka",
            {
              objectId: "object-floor",
              objectName: "Dubová podlaha",
              duration: 15,
              xp: 50,
              title: "Pozbierať veci z podlahy",
              date: "2026-10-07",
            },
          ),
          occurrence(
            "occ-week-historical",
            "task-long",
            "room-living",
            "Obývačka",
            {
              objectId: "object-floor",
              objectName: "Starý názov",
              duration: 15,
              xp: 50,
              title: "Pozbierať veci z podlahy",
              date: "2026-10-08",
            },
          ),
        ],
      },
      {
        id: "week-older",
        householdId,
        start: "2026-09-28",
        end: "2026-10-04",
        rewardCents: 1500,
        rewardEnabled: true,
        rewardIssuedAt: "2026-10-04T20:00:00.000Z",
        restDays: [3],
        lockedAt: "2026-09-28T06:00:00.000Z",
        required: [
          occurrence("occ-week-old", "task-plain", "room-living", "Obývačka", {
            title: "Preložiť pranie",
            duration: 5,
            xp: 20,
            date: "2026-10-01",
          }),
        ],
      },
    ],
    bonuses: [
      {
        id: "bonus-1",
        householdId,
        week: "2026-10-05",
        title: "Jeden úložný box",
        steps: [
          { id: "step-1", title: "Vybrať box", done: true, duration: 5 },
          { id: "step-2", title: "Vrátiť veci", done: false, duration: 5 },
        ],
        rewardCents: 500,
        monetaryEnabled: true,
        awarded: false,
        variant: 0,
      },
    ],
    megas: [
      {
        id: "mega-1",
        householdId,
        month: "2026-10",
        problemId: "problem-1",
        title: "Uvoľniť vstup",
        problem: "Topánky nemajú miesto.",
        result: "Jeden voľný rad.",
        solution: "Ponechať len sezónne páry.",
        materials: "Existujúca polica",
        budgetCents: 0,
        steps: [
          { id: "mega-step-1", title: "Vybrať páry", done: true, duration: 5 },
          {
            id: "mega-step-2",
            title: "Odložiť zvyšok",
            done: false,
            duration: 5,
          },
          {
            id: "mega-step-3",
            title: "Skontrolovať vstup",
            done: false,
            duration: 5,
          },
        ],
        before: images.before.url,
        after: images.after.url,
        awarded: false,
      },
    ],
    problems: [
      {
        id: "problem-1",
        householdId,
        roomId: "room-living",
        objectId: "object-floor",
        title: "Topánky pri dverách",
        description: "Zavadzajú pri vstupe.",
        category: "Zorganizovať",
        priority: 2,
        status: "Rozpracované",
        budgetCents: 0,
        notes: "Nekupovať nový nábytok.",
        solution: "Ponechať len sezónne páry.",
        steps: [
          {
            id: "problem-step-1",
            title: "Vybrať páry",
            done: true,
            duration: 5,
          },
        ],
        photos: [images.problemA.url, images.problemB.url],
        createdAt: "2026-09-01T08:00:00.000Z",
      },
    ],
    rewards: [
      {
        id: "reward-week",
        householdId,
        type: "weekly",
        cents: 2000,
        sourceId: "week-older",
        createdAt: "2026-10-04T20:00:00.000Z",
        description: "Týždenná odmena",
      },
      {
        id: "reward-spent",
        householdId,
        type: "redemption",
        cents: -325,
        sourceId: "wish-1",
        createdAt: "2026-10-04T21:00:00.000Z",
        description: "Káva",
      },
    ],
    achievements: [
      {
        id: "achievement-1",
        householdId,
        title: "Prvý týždeň",
        unlockedAt: "2026-10-04T20:00:00.000Z",
      },
    ],
    wishes: [
      {
        id: "wish-1",
        householdId,
        title: "Káva v obľúbenej kaviarni",
        cents: 450,
        redeemedCents: 325,
      },
    ],
    settings: [
      {
        id: "settings",
        theme: "system",
        dailyBudget: 15,
        restDays: [0, 6],
        intensity: "gentle",
        energy: 1,
        monetary: true,
        weeklyCents: 2000,
        bonusCents: 500,
        haptics: false,
        specialNeeds: "Krátke kroky, bez vône.",
      },
    ],
  };
  const stored = structuredClone(expected);
  if (version < 2) {
    stored.households[0] = strip(stored.households[0], ["timezone"]);
    stored.tasks = stored.tasks.map((task) =>
      task.id === "task-long" ? task : strip(task, ["acceptedLong"]),
    );
  }
  if (version < 3)
    stored.weeks = stored.weeks.map((week) =>
      week.id === "week-current" ? strip(week, ["restDays"]) : week,
    );
  if (version < 4) {
    const dropRef = (item: Occurrence) =>
      item.id === "occ-backfill" || item.id === "occ-week-backfill"
        ? strip(item, ["objectId", "objectName"])
        : item;
    stored.dailyPlans = stored.dailyPlans.map((plan) => ({
      ...plan,
      occurrences: plan.occurrences.map(dropRef),
    }));
    stored.weeks = stored.weeks.map((week) => ({
      ...week,
      required: week.required.map(dropRef),
    }));
  }
  return { expected, stored, images };
}
async function upgradeFrom(version: 1 | 2 | 3 | 4) {
  const name = `migration-${version}-${uid()}`;
  const { expected, stored, images } = representative(version);
  const legacy = createDatabase(name, version);
  await legacy.open();
  try {
    for (const table of tables)
      if (stored[table].length)
        await legacy.table(table).bulkPut(stored[table]);
    await legacy.table("templates").put({
      id: "legacy-template",
      title: "Umyť jednu poličku",
      instructions: "Iba predok.",
    });
  } finally {
    legacy.close();
  }
  const current = createDatabase(name);
  databases.push(current);
  const snapshot = await new LocalRepository(current).readSnapshot();
  for (const task of expected.tasks) task.tier = taskTier(task);
  for (const task of missingBasicTasks(expected)) expected.tasks.push(task);
  return { current, expected, images, snapshot };
}
describe("schema upgrades from every previous version", () => {
  it.each([1, 2, 3, 4] as const)(
    "version %i keeps household data and applies only the missing backfills",
    async (version) => {
      const { current, expected, images, snapshot } =
        await upgradeFrom(version);
      const saved = snapshot.state;
      expect(current.verno).toBe(6);
      expect(saved.households[0].timezone).toBe(
        version === 1 ? "Europe/Bratislava" : "Europe/Vienna",
      );
      expect(saved.tasks.find((task) => task.id === "task-long")).toMatchObject(
        {
          acceptedLong: true,
          duration: 15,
          objectId: "object-floor",
        },
      );
      expect(
        saved.tasks.find((task) => task.id === "task-plain"),
      ).toMatchObject({
        acceptedLong: false,
        workflow: "wash",
        eventAt: "2026-10-05T18:30:00.000Z",
        parentCompletionId: "completion-done",
      });
      expect(
        saved.tasks.find((task) => task.id === "task-mismatch")?.acceptedLong,
      ).toBe(false);
      expect(
        saved.weeks.find((week) => week.id === "week-current"),
      ).toMatchObject({
        restDays: [0, 6],
        rewardCents: 2000,
      });
      expect(
        saved.weeks.find((week) => week.id === "week-older")?.restDays,
      ).toEqual([3]);
      expect(
        saved.dailyPlans[0].occurrences.find(
          (item) => item.id === "occ-backfill",
        ),
      ).toMatchObject({
        id: "occ-backfill",
        objectId: "object-floor",
        objectName: "Dubová podlaha",
        duration: 15,
        xp: 50,
      });
      expect(
        saved.weeks
          .find((week) => week.id === "week-current")
          ?.required.find((item) => item.id === "occ-week-backfill"),
      ).toMatchObject({
        objectId: "object-floor",
        objectName: "Dubová podlaha",
      });
      expect(
        saved.dailyPlans[0].occurrences.find(
          (item) => item.id === "occ-historical",
        ),
      ).toMatchObject({
        objectId: "object-floor",
        objectName: "Starý názov",
        status: "skipped",
        deferredTo: "2026-10-06",
      });
      expect(
        saved.dailyPlans[0].occurrences.find(
          (item) => item.id === "occ-mismatch",
        )?.objectId,
      ).toBeUndefined();
      expect(
        saved.rewards.map((reward) => reward.cents).sort((a, b) => a - b),
      ).toEqual([-325, 2000]);
      expect(
        saved.completions.find((item) => item.id === "completion-done")?.undone,
      ).toBe(false);
      expect(
        saved.completions.find((item) => item.id === "completion-undo")?.undone,
      ).toBe(true);
      expect(canonicalState(saved)).toBe(canonicalState(expected));
      const photoRows = await current.table("photos").toArray();
      expect(photoRows.map((photo) => photo.id).sort()).toEqual(
        [
          "rooms:room-living:photo",
          "objects:object-floor:photo",
          "problems:problem-1:0",
          "problems:problem-1:1",
          "megas:mega-1:before",
          "megas:mega-1:after",
        ].sort(),
      );
      const byId = new Map(photoRows.map((photo) => [photo.id, photo]));
      for (const [id, image] of [
        ["rooms:room-living:photo", images.room],
        ["objects:object-floor:photo", images.object],
        ["problems:problem-1:0", images.problemA],
        ["problems:problem-1:1", images.problemB],
        ["megas:mega-1:before", images.before],
        ["megas:mega-1:after", images.after],
      ] as const) {
        expect(byId.get(id)?.mime).toBe(image.mime);
        expect(Array.from(byId.get(id)?.bytes ?? [])).toEqual(
          Array.from(image.bytes),
        );
      }
      expect((await current.table("rooms").get("room-living")).photo).toBe(
        "local-photo:rooms:room-living:photo",
      );
      expect(
        (await current.table("rooms").get("room-kitchen")).photo,
      ).toBeUndefined();
      expect((await current.table("megas").get("mega-1")).before).toBe(
        "local-photo:megas:mega-1:before",
      );
      expect(snapshot.safety).toEqual({
        id: "local",
        revision: 1,
        reminderDays: 7,
        dirtySince: "2026-04-01T12:00:00.000Z",
        lastChangedAt: "2026-04-01T12:00:00.000Z",
      });
      expect(
        await current.table("templates").get("legacy-template"),
      ).toMatchObject({
        title: "Umyť jednu poličku",
        instructions: "Iba predok.",
      });
    },
  );
  it("closes an older open tab and does not let it reopen the previous schema", async () => {
    const name = `tabs-${uid()}`;
    const older = createDatabase(name);
    databases.push(older);
    await older.open();
    await older.table("households").put({
      id: "h",
      name: "Starší domov",
      timezone: "Europe/Vienna",
    });
    const notices: string[] = [];
    const unsubscribe = subscribeUpgrade((notice) => notices.push(notice));
    try {
      const newer = new Dexie(name);
      databases.push(newer);
      newer.version(7).stores({ households: "id" });
      await Promise.race([
        newer.open(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("upgrade hung")), 2000),
        ),
      ]);
      expect(notices).toEqual(["reload"]);
      expect(older.isOpen()).toBe(false);
      await expect(older.table("households").get("h")).rejects.toMatchObject({
        name: "DatabaseClosedError",
      });
      expect(older.isOpen()).toBe(false);
      expect(await newer.table("households").get("h")).toMatchObject({
        name: "Starší domov",
        timezone: "Europe/Vienna",
      });
    } finally {
      unsubscribe();
    }
  });
  it("tells a new database when an older connection is blocking the upgrade", async () => {
    const name = `blocked-${uid()}`;
    const holder = new Dexie(name);
    databases.push(holder);
    holder.version(4).stores({ households: "id" });
    await holder.open();
    await holder.table("households").put({ id: "h", name: "Pozdržaný domov" });
    holder.on("versionchange", () => false);
    const notices: string[] = [];
    const unsubscribe = subscribeUpgrade((notice) => notices.push(notice));
    try {
      const current = createDatabase(name);
      databases.push(current);
      const opening = current.open();
      const deadline = Date.now() + 2000;
      while (!notices.includes("blocked") && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(notices).toContain("blocked");
      expect(current.isOpen()).toBe(false);
      holder.close();
      await opening;
      expect(current.verno).toBe(6);
      expect(await current.table("households").get("h")).toMatchObject({
        name: "Pozdržaný domov",
      });
      expect(await current.table("safety").get("local")).toMatchObject({
        id: "local",
      });
    } finally {
      unsubscribe();
    }
  });
});
