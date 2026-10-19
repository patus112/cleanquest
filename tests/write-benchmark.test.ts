import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { writeFileSync } from "node:fs";
import {
  canonicalState,
  createDatabase,
  LocalRepository,
} from "../src/persistence/repository";
import { complete } from "../src/domain/commands";
import { emptyState, tables, uid, type State } from "../src/domain/model";
import { shiftDay, weekStart } from "../src/domain/calendar";
import { changedSafety, defaultSafety } from "../src/domain/localSafety";
import { photoAttachmentCount, hydratePhotos, storePhotos } from "../src/persistence/photos";
import { validateState } from "../src/persistence/validation";
import { fixture, now, day } from "./fixture";

const PHOTO_BYTES = 64 * 1024;
const databases: Dexie[] = [];
const repository = () => {
  const db = createDatabase(`benchmark-${uid()}`);
  databases.push(db);
  return new LocalRepository(db);
};
afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases) await db.delete();
  databases.length = 0;
});

function syntheticPhoto(seed: number, size = PHOTO_BYTES) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i + seed * 17) & 255;
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/jpeg;base64,${btoa(raw)}`;
}

/** One household, 52 historical weeks, and 50 distinct photo blobs. */
function largeHousehold() {
  const s = fixture();
  const hid = s.households[0].id,
    roomId = s.rooms[0].id,
    roomName = s.rooms[0].name,
    first = shiftDay(weekStart(day), -52 * 7);
  for (let week = 0; week < 52; week++) {
    const start = shiftDay(first, week * 7),
      end = shiftDay(start, 6),
      required = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = shiftDay(start, offset);
      const occurrences = [0, 1].map((n) => ({
        id: `occ-${date}-${n}`,
        taskId: `task-${n}`,
        roomId,
        roomName,
        title: s.tasks[n].title,
        instructions: s.tasks[n].instructions,
        duration: 3,
        xp: 10,
        date,
        status: "pending" as const,
      }));
      s.dailyPlans.push({
        id: `plan-${date}`,
        householdId: hid,
        date,
        occurrences,
        timeBudget: 10,
        lockedAt: `${date}T12:00:00.000Z`,
      });
      for (const occurrence of occurrences) {
        required.push(structuredClone(occurrence));
        s.completions.push({
          id: `cmp-${occurrence.id}`,
          householdId: hid,
          taskId: occurrence.taskId,
          occurrenceId: occurrence.id,
          title: occurrence.title,
          roomName,
          duration: 3,
          completedAt: `${date}T12:00:00.000Z`,
          day: date,
          type: "required",
          xp: 10,
          previousDue: date,
          nextDue: date,
          undone: false,
        });
      }
    }
    s.weeks.push({
      id: `week-${start}`,
      householdId: hid,
      start,
      end,
      required,
      rewardCents: 2000,
      rewardEnabled: true,
      restDays: [0],
      rewardIssuedAt: `${end}T12:00:00.000Z`,
      lockedAt: `${start}T12:00:00.000Z`,
    });
    s.rewards.push({
      id: `reward-week-${start}`,
      householdId: hid,
      type: "weekly",
      cents: 2000,
      sourceId: `week-${start}`,
      createdAt: `${end}T12:00:00.000Z`,
      description: "Týždenný plán",
    });
    s.bonuses.push({
      id: `bonus-${start}`,
      householdId: hid,
      week: start,
      title: "Jedna polica navyše",
      steps: [
        {
          id: `step-${start}`,
          title: "Jedna polica",
          done: true,
          duration: 3,
        },
      ],
      rewardCents: 500,
      monetaryEnabled: true,
      awarded: true,
      variant: 0,
    });
    s.rewards.push({
      id: `reward-bonus-${start}`,
      householdId: hid,
      type: "bonus",
      cents: 500,
      sourceId: `bonus-${start}`,
      createdAt: `${end}T12:00:00.000Z`,
      description: "Dobrovoľná týždenná výzva",
    });
  }
  for (const [id, title] of [
    ["first", "Prvý malý krok"],
    ["ten", "Desať krokov k pokoju"],
    ["fifty", "Domov v rytme"],
  ] as const)
    s.achievements.push({
      id: `${hid}:${id}`,
      householdId: hid,
      title,
      unlockedAt: "2026-10-04T12:00:00.000Z",
    });
  s.rooms[0].photo = syntheticPhoto(1);
  for (let i = 0; i < 7; i++)
    s.rooms.push({
      id: `room-extra-${i}`,
      householdId: hid,
      floorId: s.floors[0].id,
      name: `Miestnosť ${i + 1}`,
      category: "other",
      flooring: "tile",
      order: i + 1,
      enabled: true,
      zones: [],
      photo: syntheticPhoto(10 + i),
    });
  for (let i = 0; i < 30; i++)
    s.objects.push({
      id: `obj-photo-${i}`,
      householdId: hid,
      roomId: s.rooms[i % s.rooms.length].id,
      name: `Predmet ${i + 1}`,
      category: "custom",
      quantity: 1,
      dimensions: "",
      surface: "",
      accessibility: "safe",
      photo: syntheticPhoto(100 + i),
      notes: "",
    });
  for (let i = 0; i < 6; i++)
    s.problems.push({
      id: `problem-photo-${i}`,
      householdId: hid,
      roomId,
      title: `Problém ${i + 1}`,
      description: "",
      category: "Zorganizovať",
      priority: 1,
      status: "Nové",
      budgetCents: 0,
      notes: "",
      solution: "",
      steps: [],
      photos: [syntheticPhoto(400 + i), syntheticPhoto(500 + i)],
      createdAt: "2026-10-05T12:00:00.000Z",
    });
  return s;
}

type WriteEvent = {
  table: string;
  op: "create" | "update" | "delete";
  bytes: number;
};
function byteLength(value: unknown) {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer)
    return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return 0;
}
function trackWrites(db: Dexie) {
  const events: WriteEvent[] = [];
  for (const name of [...tables, "photos", "safety"]) {
    const table = db.table(name);
    table.hook(
      "creating",
      function (_key, obj: { bytes?: unknown }) {
        events.push({
          table: name,
          op: "create",
          bytes: name === "photos" ? byteLength(obj?.bytes) : 0,
        });
      },
    );
    table.hook("updating", function (mods: { bytes?: unknown }) {
      events.push({
        table: name,
        op: "update",
        bytes: name === "photos" ? byteLength(mods?.bytes) : 0,
      });
    });
    table.hook("deleting", function (_key, obj: { bytes?: unknown }) {
      events.push({
        table: name,
        op: "delete",
        bytes: name === "photos" ? byteLength(obj?.bytes) : 0,
      });
    });
  }
  return events;
}
function summarize(events: WriteEvent[]) {
  const pick = (table: string, op: WriteEvent["op"]) =>
    events.filter((event) => event.table === table && event.op === op);
  const photo = (op: WriteEvent["op"]) => pick("photos", op);
  return {
    rowWrites: events.filter(
      (event) => event.table !== "photos" && event.table !== "safety",
    ).length,
    photoPuts:
      photo("create").length + photo("update").length,
    photoDeletes: photo("delete").length,
    photoBytesPut: [...photo("create"), ...photo("update")].reduce(
      (sum, event) => sum + event.bytes,
      0,
    ),
    photoBytesDeleted: photo("delete").reduce(
      (sum, event) => sum + event.bytes,
      0,
    ),
    safetyWrites: events.filter((event) => event.table === "safety").length,
  };
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
async function elapsed(run: () => Promise<unknown>) {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

/**
 * Previous command write: clear every household table and the photo table,
 * then bulk-put the full stored household. Kept here so the benchmark can
 * time that algorithm against the repository's per-record writes.
 */
async function transactRewriteAll(
  repo: LocalRepository,
  recipe: (state: State) => void,
) {
  let result = emptyState();
  await repo.db.transaction(
    "rw",
    [...tables, "photos", "safety"].map((table) => repo.db.table(table)),
    async () => {
      const state = emptyState();
      const photos = (await Promise.all([
        repo.db.table("photos").toArray(),
        ...tables.map(async (table) => {
          (state[table] as unknown[]) = await repo.db.table(table).toArray();
        }),
      ]))[0];
      const current = hydratePhotos(state, photos);
      const before = canonicalState(current);
      recipe(current);
      result = validateState(current);
      if (canonicalState(result) === before) return;
      const meta =
        (await repo.db.table("safety").get("local")) || defaultSafety();
      changedSafety(meta);
      const stored = storePhotos(result);
      for (const table of tables) {
        await repo.db.table(table).clear();
        if (stored.state[table].length)
          await repo.db.table(table).bulkPut(stored.state[table]);
      }
      await repo.db.table("photos").clear();
      if (stored.photos.length)
        await repo.db.table("photos").bulkPut(stored.photos);
      await repo.db.table("safety").put(meta);
    },
  );
  return result;
}

describe("write benchmark on a year of history", () => {
  it(
    "reports rewrite-all versus per-record command timings",
    async () => {
      const household = largeHousehold();
      expect(photoAttachmentCount(household)).toBe(50);
      expect(household.completions.length).toBeGreaterThanOrEqual(700);
      expect(household.dailyPlans.length).toBeGreaterThanOrEqual(360);
      const fresh = repository(),
        legacy = repository();
      await fresh.replace(structuredClone(household));
      await legacy.replace(structuredClone(household));
      const freshEvents = trackWrites(fresh.db),
        legacyEvents = trackWrites(legacy.db);
      const noopMs = [];
      for (let i = 0; i < 3; i++)
        noopMs.push(await elapsed(() => fresh.transact(() => {})));
      freshEvents.length = 0;
      const samples = 5;
      const rename = (label: string) => (state: State) => {
        state.rooms[0].name = label;
      };
      await elapsed(() => fresh.transact(rename("warmup")));
      await elapsed(() => transactRewriteAll(legacy, rename("warmup")));
      freshEvents.length = 0;
      legacyEvents.length = 0;
      const freshMs: number[] = [],
        legacyMs: number[] = [];
      for (let i = 0; i < samples; i++) {
        const label = `Obývačka ${i}`;
        freshMs.push(await elapsed(() => fresh.transact(rename(label))));
        legacyMs.push(
          await elapsed(() => transactRewriteAll(legacy, rename(label))),
        );
      }
      const freshWrites = summarize(freshEvents),
        legacyWrites = summarize(legacyEvents);
      expect(canonicalState(await fresh.read())).toBe(
        canonicalState(await legacy.read()),
      );
      freshEvents.length = 0;
      legacyEvents.length = 0;
      const occurrence = household.weeks.find((week) =>
        week.start.startsWith("2026-10-05"),
      )?.required[0];
      expect(occurrence).toBeTruthy();
      const freshCompleteMs = await elapsed(() =>
        fresh.transact((state) =>
          complete(state, occurrence!.taskId, "required", occurrence!.id, now),
        ),
      );
      const legacyCompleteMs = await elapsed(() =>
        transactRewriteAll(legacy, (state) =>
          complete(state, occurrence!.taskId, "required", occurrence!.id, now),
        ),
      );
      const freshComplete = summarize(freshEvents),
        legacyComplete = summarize(legacyEvents);
      const photoTotal = 50 * PHOTO_BYTES;
      const report = {
        measuredAt: new Date().toISOString(),
        runtime: `Node ${process.version}, ${process.platform} ${process.arch}`,
        engine:
          "fake-indexeddb 6 in Vitest (in-memory). Not a phone and not Chromium IndexedDB. Timings include read, hydrate, canonical compare, validation and the write. Hook byte counts are the IndexedDB mutations observed during the timed samples.",
        household: {
          completions: household.completions.length,
          dailyPlans: household.dailyPlans.length,
          weeks: household.weeks.length,
          rewards: household.rewards.length,
          photos: 50,
          photoBytesEach: PHOTO_BYTES,
          photoBytesTotal: photoTotal,
          records: tables.reduce((sum, table) => sum + household[table].length, 0),
        },
        method:
          "3 untimed no-op commands, 1 untimed warmup rename, then 5 renames of the same room. Median of the 5. Legacy path is the previous clear-and-bulkPut write, reimplemented in this test and run on a second database seeded with the same household. A completion of one current-week occurrence is timed once afterwards.",
        noopCommandMs: Number(median(noopMs).toFixed(1)),
        renameRoom: {
          samples,
          perRecordMedianMs: Number(median(freshMs).toFixed(1)),
          rewriteAllMedianMs: Number(median(legacyMs).toFixed(1)),
          perRecordSamplesMs: freshMs.map((ms) => Number(ms.toFixed(1))),
          rewriteAllSamplesMs: legacyMs.map((ms) => Number(ms.toFixed(1))),
          perRecord: freshWrites,
          rewriteAll: legacyWrites,
        },
        completeOneTask: {
          perRecordMs: Number(freshCompleteMs.toFixed(1)),
          rewriteAllMs: Number(legacyCompleteMs.toFixed(1)),
          perRecord: freshComplete,
          rewriteAll: legacyComplete,
        },
      };
      writeFileSync(
        "/tmp/cleanquest-write-benchmark.json",
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report, null, 2));
      expect(freshWrites.photoBytesPut).toBe(0);
      expect(freshWrites.photoBytesDeleted).toBe(0);
      expect(freshWrites.photoPuts).toBe(0);
      expect(freshWrites.photoDeletes).toBe(0);
      expect(freshWrites.rowWrites).toBe(samples);
      expect(legacyWrites.photoBytesPut).toBe(photoTotal * samples);
      expect(legacyWrites.photoPuts).toBe(50 * samples);
      expect(legacyWrites.rowWrites).toBeGreaterThan(freshWrites.rowWrites * 10);
      expect(freshComplete.photoBytesPut).toBe(0);
      expect(freshComplete.photoPuts).toBe(0);
      expect(legacyComplete.photoBytesPut).toBe(photoTotal);
      expect((await fresh.read()).completions.length).toBe(
        household.completions.length + 1,
      );
    },
    120_000,
  );
});
