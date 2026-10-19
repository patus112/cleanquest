import Dexie from "dexie";
import { emptyState, tables, type State } from "../domain/model";
import { validateState } from "./validation";
import { templates } from "../data/templates";
import {
  defaultSafety,
  changedSafety,
  type LocalSafety,
  type PreparedExport,
} from "../domain/localSafety";
import {
  storePhotos,
  hydratePhotos,
  photoReferences,
  decodePhoto,
  type StoredPhoto,
} from "./photos";
export const DATABASE_VERSION = 5;
export type UpgradeNotice = "reload" | "blocked";
const upgradeListeners = new Set<(notice: UpgradeNotice) => void>();
export function subscribeUpgrade(listener: (notice: UpgradeNotice) => void) {
  upgradeListeners.add(listener);
  return () => upgradeListeners.delete(listener);
}
function publishUpgrade(notice: UpgradeNotice) {
  for (const listener of upgradeListeners) listener(notice);
}
const entitySchema = {
  profiles: "id",
  households: "id",
  floors: "id,householdId,order",
  rooms: "id,householdId,floorId,order",
  objects: "id,householdId,roomId,category",
  tasks: "id,householdId,roomId,objectId,nextDue,enabled,templateId",
  completions: "id,householdId,taskId,occurrenceId,day,completedAt",
  dailyPlans: "id,householdId,&date",
  weeks: "id,householdId,&start",
  bonuses: "id,householdId,&week",
  megas: "id,householdId,&month",
  problems: "id,householdId,roomId,status",
  rewards: "id,householdId,sourceId,createdAt",
  achievements: "id,householdId",
  wishes: "id,householdId",
  settings: "id",
  templates: "id",
};
function storesFor(version: number) {
  return {
    ...entitySchema,
    tasks:
      version >= 2
        ? entitySchema.tasks + ",parentCompletionId,eventAt"
        : entitySchema.tasks,
    ...(version >= 5 ? { photos: "id", safety: "id" } : {}),
  };
}
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  return value;
}
export const canonicalState = (s: State) =>
  JSON.stringify(
    canonicalValue(
      Object.fromEntries(
        tables.map((t) => [
          t,
          [...s[t]].sort((a, b) => a.id.localeCompare(b.id)),
        ]),
      ),
    ),
  );
const canonicalJson = (value: unknown) => JSON.stringify(canonicalValue(value));
type TableName = (typeof tables)[number];
type Row = { id: string };
interface StoredSnapshot {
  state: State;
  photos: StoredPhoto[];
}
const UNIQUE_FIELD: Partial<Record<TableName, string>> = {
  dailyPlans: "date",
  weeks: "start",
  bonuses: "week",
  megas: "month",
};
function asBytes(value: unknown) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return Uint8Array.from(value as ArrayLike<number>);
}
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a === b) return true;
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
function storedRow(table: TableName, row: Row): Row {
  if (table === "rooms" || table === "objects") {
    const record = row as Row & { photo?: string };
    return record.photo
      ? ({ ...record, photo: `local-photo:${table}:${record.id}:photo` } as Row)
      : row;
  }
  if (table === "problems") {
    const record = row as Row & { photos: string[] };
    return {
      ...record,
      photos: record.photos.map((value, index) =>
        value ? `local-photo:problems:${record.id}:${index}` : value,
      ),
    } as Row;
  }
  if (table === "megas") {
    const record = row as Row & { before?: string; after?: string };
    if (!record.before && !record.after) return row;
    return {
      ...record,
      before: record.before
        ? `local-photo:megas:${record.id}:before`
        : record.before,
      after: record.after
        ? `local-photo:megas:${record.id}:after`
        : record.after,
    } as Row;
  }
  return row;
}
function nextPhotos(
  state: State,
  previous: StoredPhoto[],
  previousUrls?: Map<string, string>,
) {
  const previousById = new Map(previous.map((photo) => [photo.id, photo]));
  const photos: StoredPhoto[] = [];
  for (const [id, value] of photoReferences(state)) {
    const prior = previousById.get(id);
    if (prior && previousUrls?.get(id) === value) {
      photos.push(prior);
      continue;
    }
    const decoded = decodePhoto(value);
    if (
      prior &&
      prior.mime === decoded.mime &&
      sameBytes(asBytes(prior.bytes), decoded.bytes)
    ) {
      photos.push(prior);
      continue;
    }
    photos.push({ id, mime: decoded.mime, bytes: decoded.bytes });
  }
  return photos;
}
export interface Repository {
  read(): Promise<State>;
  transact(recipe: (state: State) => void): Promise<State>;
  replace(state: State): Promise<State>;
  readSnapshot(): Promise<{ state: State; safety: LocalSafety }>;
  restore(
    state: State,
    reminderDays?: LocalSafety["reminderDays"],
    sourceSafety?: LocalSafety,
  ): Promise<State>;
  updateSafety(action: (meta: LocalSafety) => void): Promise<LocalSafety>;
  markExportPrepared(prepared: PreparedExport): Promise<LocalSafety>;
  confirmBackup(exportId: string): Promise<LocalSafety>;
}
export function createDatabase(
  name = "cleanquest",
  version = DATABASE_VERSION,
) {
  if (!Number.isInteger(version) || version < 1 || version > DATABASE_VERSION)
    throw new Error("Nepodporovaná verzia databázy.");
  const db = new Dexie(name);
  db.version(1).stores(storesFor(1));
  if (version >= 2)
    db.version(2)
      .stores(storesFor(2))
      .upgrade(async (tx) => {
        await tx
          .table("households")
          .toCollection()
          .modify((h) => {
            h.timezone ||= "Europe/Bratislava";
          });
        await tx
          .table("tasks")
          .toCollection()
          .modify((t) => {
            t.acceptedLong ??= false;
          });
      });
  if (version >= 3)
    db.version(3)
      .stores(storesFor(3))
      .upgrade(async (tx) => {
        const settings = await tx.table("settings").get("settings");
        await tx
          .table("weeks")
          .toCollection()
          .modify((w) => {
            w.restDays ??= settings?.restDays || [0];
          });
      });
  if (version >= 4)
    db.version(4)
      .stores(storesFor(4))
      .upgrade(async (tx) => {
        const tasks = new Map(
          (await tx.table("tasks").toArray()).map((t) => [t.id, t]),
        );
        const objects = new Map(
          (await tx.table("objects").toArray()).map((o) => [o.id, o]),
        );
        // Preserve existing plan identities and rewards; add only visual references.
        for (const [table, field] of [
          ["dailyPlans", "occurrences"],
          ["weeks", "required"],
        ])
          await tx
            .table(table)
            .toCollection()
            .modify((plan) => {
              for (const item of plan[field] || []) {
                const object = objects.get(tasks.get(item.taskId)?.objectId);
                if (object && object.roomId === item.roomId && !item.objectId) {
                  item.objectId = object.id;
                  item.objectName = object.name;
                }
              }
            });
      });
  if (version >= 5)
    db.version(5)
      .stores(storesFor(5))
      .upgrade(async (tx) => {
        const s = emptyState();
        for (const table of tables)
          (s[table] as unknown[]) = await tx.table(table).toArray();
        const stored = storePhotos(s);
        if (stored.photos.length)
          await tx.table("photos").bulkPut(stored.photos);
        for (const table of ["rooms", "objects", "problems", "megas"] as const)
          if (stored.state[table].length)
            await tx.table(table).bulkPut(stored.state[table]);
        const meta = defaultSafety();
        if (s.households.length) {
          changedSafety(
            meta,
            s.households[0].createdAt || new Date().toISOString(),
          );
        }
        await tx.table("safety").put(meta);
      });
  // Dexie already closes on versionchange, but with auto-open left on, so the
  // stale bundle can reopen an older schema and surface a version error.
  // Returning false skips that default. A blocked upgrade only logs a warning
  // and otherwise waits forever, so the UI can subscribe and explain it.
  db.on("versionchange", (event) => {
    try {
      if (event.newVersion && event.newVersion > 0) publishUpgrade("reload");
    } finally {
      db.close({ disableAutoOpen: true });
    }
    return false;
  });
  db.on("blocked", (event) => {
    if (!event.newVersion || event.newVersion < event.oldVersion) return;
    publishUpgrade("blocked");
  });
  return db;
}
export class LocalRepository implements Repository {
  constructor(public db: Dexie = createDatabase()) {}
  async initialize() {
    await this.db.open();
    await this.db.table("templates").bulkPut(templates);
  }
  async read(): Promise<State> {
    return (await this.readSnapshot()).state;
  }
  async readSnapshot() {
    let result = { state: emptyState(), safety: defaultSafety() };
    await this.db.transaction("r", this.transactionTables(), async () => {
      result = {
        state: await this.readInside(),
        safety: await this.safetyInside(),
      };
    });
    return result;
  }
  private async readStored(): Promise<StoredSnapshot> {
    const state = emptyState();
    const photosPromise = this.db.table("photos").toArray() as Promise<
      StoredPhoto[]
    >;
    await Promise.all(
      tables.map(async (table) => {
        (state[table] as unknown[]) = await this.db.table(table).toArray();
      }),
    );
    return { state, photos: await photosPromise };
  }
  private async readInside(): Promise<State> {
    const stored = await this.readStored();
    return hydratePhotos(stored.state, stored.photos);
  }
  private transactionTables() {
    return [...tables, "photos", "safety"].map((t) => this.db.table(t));
  }
  private async safetyInside(): Promise<LocalSafety> {
    return (await this.db.table("safety").get("local")) || defaultSafety();
  }
  /** Puts and deletes only rows whose stored form changed. One transaction. */
  private async writeChanged(
    previous: StoredSnapshot,
    next: State,
    previousPhotoUrls?: Map<string, string>,
  ) {
    for (const table of tables)
      await this.diffTable(
        table,
        previous.state[table] as Row[],
        (next[table] as Row[]).map((row) => storedRow(table, row)),
      );
    await this.diffPhotos(
      previous.photos,
      nextPhotos(next, previous.photos, previousPhotoUrls),
    );
  }
  private async diffTable(table: TableName, before: Row[], after: Row[]) {
    if (!before.length && !after.length) return;
    const previousRows = new Map(before.map((row) => [row.id, row]));
    const seen = new Set<string>();
    const puts: Row[] = [];
    for (const row of after) {
      seen.add(row.id);
      const prior = previousRows.get(row.id);
      if (!prior) {
        puts.push(row);
        continue;
      }
      // Stored rows keep the key order we wrote. Canonicalize only when that
      // order differs, so a large unchanged household is not sorted row by row.
      if (
        JSON.stringify(prior) !== JSON.stringify(row) &&
        canonicalJson(prior) !== canonicalJson(row)
      )
        puts.push(row);
    }
    const removed = [...previousRows.keys()].filter((id) => !seen.has(id));
    const unique = UNIQUE_FIELD[table];
    const rekey = unique
      ? puts
          .filter((row) => {
            const prior = previousRows.get(row.id);
            return (
              prior !== undefined &&
              (prior as Record<string, unknown>)[unique] !==
                (row as Record<string, unknown>)[unique]
            );
          })
          .map((row) => row.id)
      : [];
    const store = this.db.table(table);
    // Delete moved unique keys before put so two rows can swap dates.
    if (rekey.length) await store.bulkDelete(rekey);
    if (removed.length) await store.bulkDelete(removed);
    if (puts.length) await store.bulkPut(puts);
  }
  private async diffPhotos(before: StoredPhoto[], after: StoredPhoto[]) {
    const previous = new Map(before.map((photo) => [photo.id, photo]));
    const seen = new Set<string>();
    const puts: StoredPhoto[] = [];
    for (const photo of after) {
      seen.add(photo.id);
      // `nextPhotos` reuses the stored object when the blob is unchanged.
      if (previous.get(photo.id) !== photo) puts.push(photo);
    }
    const removed = [...previous.keys()].filter((id) => !seen.has(id));
    const store = this.db.table("photos");
    if (removed.length) await store.bulkDelete(removed);
    if (puts.length) await store.bulkPut(puts);
  }
  async transact(recipe: (state: State) => void): Promise<State> {
    let result = emptyState();
    await this.db.transaction("rw", this.transactionTables(), async () => {
      const stored = await this.readStored();
      const current = hydratePhotos(
        structuredClone(stored.state),
        stored.photos,
      );
      const before = canonicalState(current);
      const previousPhotoUrls = photoReferences(current);
      recipe(current);
      result = validateState(current);
      if (canonicalState(result) !== before) {
        const meta = await this.safetyInside();
        changedSafety(meta);
        await this.writeChanged(stored, result, previousPhotoUrls);
        await this.db.table("safety").put(meta);
      }
    });
    return result;
  }
  async replace(state: State): Promise<State> {
    return this.restore(state);
  }
  async restore(
    state: State,
    reminderDays?: LocalSafety["reminderDays"],
    sourceSafety?: LocalSafety,
  ): Promise<State> {
    const valid = validateState(state);
    await this.db.transaction("rw", this.transactionTables(), async () => {
      await this.writeChanged(await this.readStored(), valid);
      if (canonicalState(await this.readInside()) !== canonicalState(valid))
        throw new Error(
          "Kontrola obnovy zlyhala. Pôvodné údaje zostali zachované.",
        );
      const meta = await this.safetyInside();
      changedSafety(meta);
      meta.confirmed = undefined;
      meta.lastExport = undefined;
      meta.snoozedUntil = undefined;
      meta.dirtySince = new Date().toISOString();
      meta.lastRestoredAt = meta.dirtySince;
      if (reminderDays !== undefined) meta.reminderDays = reminderDays;
      if (sourceSafety?.confirmed)
        meta.confirmed = {
          ...sourceSafety.confirmed,
          revision:
            sourceSafety.confirmed.revision === sourceSafety.revision
              ? meta.revision
              : Math.max(0, meta.revision - 1),
        };
      if (sourceSafety?.lastExport)
        meta.lastExport = {
          ...sourceSafety.lastExport,
          revision:
            sourceSafety.lastExport.revision === sourceSafety.revision
              ? meta.revision
              : Math.max(0, meta.revision - 1),
        };
      await this.db.table("safety").put(meta);
    });
    return valid;
  }
  async updateSafety(
    action: (meta: LocalSafety) => void,
  ): Promise<LocalSafety> {
    return this.db.transaction("rw", this.db.table("safety"), async () => {
      const meta = await this.safetyInside();
      action(meta);
      await this.db.table("safety").put(meta);
      return meta;
    });
  }
  async markExportPrepared(prepared: PreparedExport) {
    return this.updateSafety((meta) => {
      if (prepared.revision > meta.revision)
        throw new Error("Záloha má neplatnú revíziu.");
      meta.lastExport = prepared;
    });
  }
  async confirmBackup(exportId: string) {
    return this.updateSafety((meta) => {
      if (meta.lastExport?.id !== exportId)
        throw new Error(
          "Priprav zálohu znova a potvrď uloženie správneho súboru.",
        );
      meta.confirmed = {
        ...meta.lastExport,
        confirmedAt: new Date().toISOString(),
      };
      meta.snoozedUntil = undefined;
    });
  }
}
