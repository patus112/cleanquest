import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { createDatabase, LocalRepository } from "../src/persistence/repository";
import { complete, undo, redeem } from "../src/domain/commands";
import { emptyState, uid, tables } from "../src/domain/model";
import { balance, totalXp } from "../src/domain/rewards";
import { importBackup, exportBackup } from "../src/persistence/validation";
import { fixture, now } from "./fixture";
const databases: Dexie[] = [];
const repository = () => {
  const db = createDatabase(`test-${uid()}`);
  databases.push(db);
  return new LocalRepository(db);
};
afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases) await db.delete();
  databases.length = 0;
});
describe("real IndexedDB repository with fake-indexeddb", () => {
  it("persists across repository close and reopen", async () => {
    const repo = repository();
    await repo.initialize();
    const s = fixture();
    await repo.replace(s);
    repo.db.close();
    await repo.db.open();
    expect(await repo.read()).toEqual(s);
  });
  it("stores completion, recurrence, DA, achievement and wallet atomically", async () => {
    const repo = repository();
    await repo.replace(fixture());
    await repo.transact((s) => {
      for (const o of s.weeks[0].required)
        complete(s, o.taskId, "required", o.id, now);
    });
    const saved = await repo.read();
    expect(totalXp(saved)).toBe(30);
    expect(balance(saved)).toBe(2000);
    expect(saved.achievements).toHaveLength(1);
  });
  it("concurrent commands serialize and duplicate completion stays idempotent", async () => {
    const repo = repository(),
      s = fixture();
    await repo.replace(s);
    const o = s.weeks[0].required[0];
    await Promise.all(
      Array.from({ length: 6 }, () =>
        repo.transact((state) =>
          complete(state, o.taskId, "required", o.id, now),
        ),
      ),
    );
    expect((await repo.read()).completions).toHaveLength(1);
  });
  it("a second repository over same database does not lose simultaneous updates", async () => {
    const a = repository(),
      b = new LocalRepository(createDatabase(a.db.name));
    databases.push(b.db);
    const s = fixture();
    await a.replace(s);
    await Promise.all(
      s.weeks[0].required.map((o, i) =>
        (i % 2 ? a : b).transact((state) =>
          complete(state, o.taskId, "required", o.id, now),
        ),
      ),
    );
    expect(totalXp(await a.read())).toBe(30);
  });
  it("interrupted multi-record operation leaves original state intact", async () => {
    const repo = repository(),
      s = fixture();
    await repo.replace(s);
    await expect(
      repo.transact((state) => {
        const o = state.weeks[0].required[0];
        complete(state, o.taskId, "required", o.id, now);
        throw new Error("simulated interruption");
      }),
    ).rejects.toThrow();
    expect(await repo.read()).toEqual(s);
  });
  it("validation failure rolls back all changes", async () => {
    const repo = repository(),
      s = fixture();
    await repo.replace(s);
    await expect(
      repo.transact((state) => {
        state.rooms = [];
      }),
    ).rejects.toThrow();
    expect(await repo.read()).toEqual(s);
  });
  it("invalid laundry cycle cannot leave partial completion", async () => {
    const repo = repository(),
      s = fixture(),
      o = s.weeks[0].required[0];
    s.tasks.find((t) => t.id === o.taskId)!.workflow = "wash";
    await repo.replace(s);
    await expect(
      repo.transact((state) =>
        complete(state, o.taskId, "required", o.id, now, 0),
      ),
    ).rejects.toThrow();
    expect((await repo.read()).completions).toEqual([]);
  });
  it("backup reset restore recovers complete configuration and accounting", async () => {
    const repo = repository(),
      s = fixture();
    await repo.replace(s);
    await repo.transact((state) => {
      for (const o of state.weeks[0].required)
        complete(state, o.taskId, "required", o.id, now);
      redeem(state, 325, "Káva");
    });
    const previous = await repo.read(),
      backup = exportBackup(previous);
    await repo.replace(emptyState());
    expect((await repo.read()).households).toEqual([]);
    await repo.replace(importBackup(backup).data);
    expect(await repo.read()).toEqual(previous);
  });
  it("invalid restore preserves current household", async () => {
    const repo = repository(),
      s = fixture();
    await repo.replace(s);
    const corrupt = structuredClone(s);
    corrupt.objects[0].roomId = "gone";
    await expect(repo.replace(corrupt)).rejects.toThrow();
    expect(await repo.read()).toEqual(s);
  });
  it("separate database installations stay independent", async () => {
    const a = repository(),
      b = repository();
    await a.replace(fixture());
    await b.replace({
      ...fixture(),
      profiles: [
        { id: "p", displayName: "Mama", createdAt: now.toISOString() },
      ],
    });
    await a.transact((s) => {
      const o = s.weeks[0].required[0];
      complete(s, o.taskId, "required", o.id, now);
    });
    expect((await b.read()).completions).toEqual([]);
    expect((await b.read()).profiles[0].displayName).toBe("Mama");
  });
  it("undo and wallet correction survive reload", async () => {
    const repo = repository();
    await repo.replace(fixture());
    await repo.transact((s) => {
      for (const o of s.weeks[0].required)
        complete(s, o.taskId, "required", o.id, now);
      redeem(s, 250, "Čaj");
      undo(s, s.completions[0].id);
    });
    repo.db.close();
    await repo.db.open();
    expect(balance(await repo.read())).toBe(-250);
  });
  it("version one database migrates to version five safely", async () => {
    const name = `migration-${uid()}`,
      legacy = new Dexie(name);
    legacy.version(1).stores({ households: "id", tasks: "id" });
    await legacy.open();
    await legacy.table("households").put({ id: "h", name: "Starší domov" });
    await legacy.table("tasks").put({ id: "t", title: "Staršia úloha" });
    legacy.close();
    const current = createDatabase(name);
    databases.push(current);
    await current.open();
    expect(current.verno).toBe(5);
    expect((await current.table("households").get("h")).timezone).toBe(
      "Europe/Bratislava",
    );
    expect((await current.table("tasks").get("t")).acceptedLong).toBe(false);
  });
  it("version three migration adds target references without changing obligations or money", async () => {
    const name = `migration-${uid()}`,
      legacy = new Dexie(name),
      s = fixture();
    s.tasks[0].objectId = s.objects[0].id;
    legacy.version(3).stores(Object.fromEntries(tables.map((t) => [t, "id"])));
    await legacy.open();
    for (const t of tables)
      if (s[t].length) await legacy.table(t).bulkPut(s[t]);
    legacy.close();
    const current = createDatabase(name);
    databases.push(current);
    const saved = await new LocalRepository(current).read();
    expect(
      saved.dailyPlans[0].occurrences.find((o) => o.taskId === s.tasks[0].id)
        ?.objectId,
    ).toBe(s.objects[0].id);
    expect(
      saved.weeks[0].required.find((o) => o.taskId === s.tasks[0].id)
        ?.objectName,
    ).toBe(s.objects[0].name);
    expect(saved.weeks[0].required.map((o) => o.id)).toEqual(
      s.weeks[0].required.map((o) => o.id),
    );
    expect(saved.rewards).toEqual(s.rewards);
    expect(saved.weeks[0].rewardCents).toBe(2000);
  });
  it("new room configuration and object position survive restart and backup recovery", async () => {
    const repo = repository(),
      s = fixture();
    Object.assign(s.rooms[0], {
      windowArea: 14,
      curtains: true,
      floorSurfaces: [{ material: "carpet", area: 5.5 }],
    });
    s.objects[0].position = { x: 80, y: 20 };
    await repo.replace(s);
    repo.db.close();
    await repo.db.open();
    expect(await repo.read()).toEqual(s);
    const backup = exportBackup(await repo.read());
    await repo.replace(emptyState());
    await repo.replace(importBackup(backup).data);
    expect(await repo.read()).toEqual(s);
  });
});
