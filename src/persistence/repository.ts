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
import { storePhotos, hydratePhotos } from "./photos";
export const DATABASE_VERSION = 5;
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
export function createDatabase(name = "cleanquest"): Dexie {
  const db = new Dexie(name);
  const schema = {
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
  db.version(1).stores(schema);
  db.version(2)
    .stores({ ...schema, tasks: schema.tasks + ",parentCompletionId,eventAt" })
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
  db.version(3)
    .stores({ ...schema, tasks: schema.tasks + ",parentCompletionId,eventAt" })
    .upgrade(async (tx) => {
      const settings = await tx.table("settings").get("settings");
      await tx
        .table("weeks")
        .toCollection()
        .modify((w) => {
          w.restDays ??= settings?.restDays || [0];
        });
    });
  db.version(4)
    .stores({ ...schema, tasks: schema.tasks + ",parentCompletionId,eventAt" })
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
  db.version(5)
    .stores({
      ...schema,
      tasks: schema.tasks + ",parentCompletionId,eventAt",
      photos: "id",
      safety: "id",
    })
    .upgrade(async (tx) => {
      const s = emptyState();
      for (const table of tables)
        (s[table] as unknown[]) = await tx.table(table).toArray();
      const stored = storePhotos(s);
      if (stored.photos.length) await tx.table("photos").bulkPut(stored.photos);
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
  private async readInside(): Promise<State> {
    const s = emptyState();
    await Promise.all(
      tables.map(async (t) => {
        (s[t] as unknown[]) = await this.db.table(t).toArray();
      }),
    );
    return hydratePhotos(s, await this.db.table("photos").toArray());
  }
  private transactionTables() {
    return [...tables, "photos", "safety"].map((t) => this.db.table(t));
  }
  private async safetyInside(): Promise<LocalSafety> {
    return (await this.db.table("safety").get("local")) || defaultSafety();
  }
  private async writeInside(s: State) {
    const stored = storePhotos(s);
    for (const t of tables) {
      await this.db.table(t).clear();
      if (stored.state[t].length)
        await this.db.table(t).bulkPut(stored.state[t] as { id: string }[]);
    }
    await this.db.table("photos").clear();
    if (stored.photos.length)
      await this.db.table("photos").bulkPut(stored.photos);
  }
  async transact(recipe: (state: State) => void): Promise<State> {
    let result = emptyState();
    await this.db.transaction("rw", this.transactionTables(), async () => {
      const s = await this.readInside();
      const before = canonicalState(s);
      recipe(s);
      result = validateState(s);
      if (canonicalState(result) !== before) {
        const meta = await this.safetyInside();
        changedSafety(meta);
        await this.writeInside(result);
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
      await this.writeInside(valid);
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
