import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";
import Dexie from "dexie";
import { fixture, now } from "./fixture";
import { complete, redeem } from "../src/domain/commands";
import { totalXp, balance, levelFor } from "../src/domain/rewards";
import { emptyState, tables, uid } from "../src/domain/model";
import { backupReminderDue, defaultSafety } from "../src/domain/localSafety";
import {
  checksum,
  openBackup,
  prepareBackup,
  readFileBytes,
  validateArchive,
  MAX_ARCHIVE_BYTES,
} from "../src/persistence/backup";
import {
  createDatabase,
  LocalRepository,
  canonicalState,
} from "../src/persistence/repository";
import { exportBackup } from "../src/persistence/validation";
import {
  storageError,
  shareBackup,
  storageConstrained,
  storageStatus,
  requestPersistentStorage,
} from "../src/persistence/storage";

export const testPhoto =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcN0AAAAASUVORK5CYII=";
const databases: Dexie[] = [];
const repository = () => {
  const db = createDatabase(`backup-${uid()}`);
  databases.push(db);
  return new LocalRepository(db);
};
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});
function sample() {
  const s = fixture();
  for (const o of s.weeks[0].required)
    complete(s, o.taskId, "required", o.id, now);
  redeem(s, 325, "Káva");
  s.rooms[0].photo = testPhoto;
  s.objects[0].photo = testPhoto;
  return s;
}
async function archive(s = sample()) {
  const meta = { ...defaultSafety(), revision: 5, reminderDays: 14 as const },
    prepared = await prepareBackup(s, meta, now);
  return { prepared, bytes: await readFileBytes(prepared.file), s, meta };
}
async function resign(files: Record<string, Uint8Array>) {
  const m = JSON.parse(strFromU8(files["manifest.json"]));
  for (const path of Object.keys(m.checksums))
    if (files[path]) m.checksums[path] = await checksum(files[path]);
  delete m.manifestSha256;
  m.manifestSha256 = await checksum(strToU8(JSON.stringify(m)));
  files["manifest.json"] = strToU8(JSON.stringify(m));
  return zipSync(files);
}
describe("complete versioned ZIP backups", () => {
  it("exports a manifest, every household table and binary photos with valid SHA-256 checksums", async () => {
    const { prepared, bytes, s, meta } = await archive(),
      files = unzipSync(bytes),
      manifest = prepared.manifest;
    expect(prepared.file.name).toMatch(
      /^cleanquest-backup-2026-10-05-\d{4}\.zip$/,
    );
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["manifest.json", "data.json", "photos/0001.png"]),
    );
    expect(manifest.photoCount).toBe(1); // Identical attachments are stored once; both references survive.
    expect(manifest.records).toEqual(
      Object.fromEntries(tables.map((t) => [t, s[t].length])),
    );
    expect(manifest.applicationVersion).toBeTruthy();
    expect(manifest.householdId).toBe(s.households[0].id);
    expect(manifest.dataRevision).toBe(meta.revision);
    expect(strFromU8(files["data.json"])).not.toContain("data:image");
    expect(await checksum(files["data.json"])).toBe(
      manifest.checksums["data.json"],
    );
    const restored = await validateArchive(bytes);
    expect(restored.data).toEqual(s);
    expect(restored.sourceSafety).toEqual(meta);
    expect(restored.verified).toBe(true);
    expect(restored.reminderDays).toBe(14);
    expect(balance(restored.data)).toBe(1675);
    expect(totalXp(restored.data)).toBe(30);
    expect(levelFor(totalXp(restored.data))).toEqual(levelFor(totalXp(s)));
    expect(restored.data.tasks.map((t) => t.recurrence)).toEqual(
      s.tasks.map((t) => t.recurrence),
    );
  });
  it("rejects changed photo bytes before restore", async () => {
    const files = unzipSync((await archive()).bytes);
    files["photos/0001.png"][10] ^= 1;
    await expect(validateArchive(zipSync(files))).rejects.toThrow(
      "Kontrolný súčet",
    );
  });
  it("rejects a damaged manifest", async () => {
    const files = unzipSync((await archive()).bytes),
      manifest = JSON.parse(strFromU8(files["manifest.json"]));
    manifest.photoCount = 999;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(validateArchive(zipSync(files))).rejects.toThrow("manifestu");
  });
  it("rejects missing photos and missing required archive entries", async () => {
    const files = unzipSync((await archive()).bytes);
    delete files["photos/0001.png"];
    await expect(validateArchive(zipSync(files))).rejects.toThrow(
      /chýba|Počty/,
    );
    delete files["manifest.json"];
    await expect(validateArchive(zipSync(files))).rejects.toThrow(
      "manifest.json",
    );
  });
  it("rejects unsupported versions without replacing current data", async () => {
    const files = unzipSync((await archive()).bytes),
      manifest = JSON.parse(strFromU8(files["manifest.json"]));
    manifest.formatVersion = 99;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(validateArchive(zipSync(files))).rejects.toThrow("verzia");
  });
  it("rejects duplicate records, missing fields and broken relationships even with correct checksums", async () => {
    for (const mutation of [
      (data: ReturnType<typeof sample>) =>
        data.tasks.push({ ...data.tasks[0] }),
      (data: ReturnType<typeof sample>) => {
        data.objects[0].roomId = "missing-room";
      },
      (data: ReturnType<typeof sample>) => {
        delete (data.rooms[0] as Partial<(typeof data.rooms)[0]>).name;
      },
    ]) {
      const files = unzipSync((await archive()).bytes),
        payload = JSON.parse(strFromU8(files["data.json"]));
      mutation(payload.data);
      files["data.json"] = strToU8(JSON.stringify(payload));
      await expect(validateArchive(await resign(files))).rejects.toThrow();
    }
  });
  it("rejects unexpected paths, malformed ZIP files and excessive declared expansion", async () => {
    await expect(validateArchive(strToU8("not a zip"))).rejects.toThrow("ZIP");
    const files = unzipSync((await archive()).bytes);
    files["../outside.json"] = strToU8("{}");
    await expect(validateArchive(zipSync(files))).rejects.toThrow("štruktúra");
    const huge = zipSync({ "data.json": strToU8("{}") });
    for (let i = 0; i < huge.length - 30; i++)
      if (
        huge[i] === 80 &&
        huge[i + 1] === 75 &&
        huge[i + 2] === 1 &&
        huge[i + 3] === 2
      ) {
        new DataView(huge.buffer).setUint32(
          i + 24,
          MAX_ARCHIVE_BYTES + 1,
          true,
        );
        break;
      }
    await expect(validateArchive(huge)).rejects.toThrow("veľká");
  });
  it("keeps legacy JSON backups importable with an explicit unverified-checksum status", async () => {
    const s = sample(),
      old = JSON.parse(exportBackup(s));
    old.version = 1;
    const imported = await openBackup(
      new File([JSON.stringify(old)], "old.json", { type: "application/json" }),
    );
    expect(imported.data).toEqual(s);
    expect(imported.verified).toBe(false);
    expect(imported.photoCount).toBe(2);
  });
});
describe("binary persistence, safe restoration and revisions", () => {
  it("stores photos as binary records and hydrates them after reopening", async () => {
    const repo = repository(),
      s = sample();
    await repo.replace(s);
    expect((await repo.db.table("rooms").toArray())[0].photo).toMatch(
      /^local-photo:/,
    );
    const photos = await repo.db.table("photos").toArray();
    expect(photos).toHaveLength(2);
    expect(ArrayBuffer.isView(photos[0].bytes)).toBe(true);
    expect(photos[0].bytes.BYTES_PER_ELEMENT).toBe(1);
    repo.db.close();
    await repo.db.open();
    expect(canonicalState(await repo.read())).toBe(canonicalState(s));
  });
  it("fully restores photos, recurrence, DA, wallet, achievements, plans and backup preferences", async () => {
    const repo = repository(),
      backup = await validateArchive((await archive()).bytes);
    await repo.replace(emptyState());
    await repo.restore(backup.data, backup.reminderDays, backup.sourceSafety);
    expect(canonicalState(await repo.read())).toBe(canonicalState(backup.data));
    expect((await repo.readSnapshot()).safety.reminderDays).toBe(14);
  });
  it("an interrupted photo restore rolls back data, binary assets and safety metadata", async () => {
    const repo = repository(),
      original = sample();
    await repo.replace(original);
    const before = await repo.readSnapshot(),
      assets = await repo.db.table("photos").toArray(),
      hook = () => {
        throw new Error("interrupted restoration");
      };
    repo.db.table("photos").hook("creating", hook);
    const target = fixture();
    target.rooms[0].photo = testPhoto;
    await expect(repo.restore(target)).rejects.toThrow();
    repo.db.table("photos").hook("creating").unsubscribe(hook);
    expect(await repo.readSnapshot()).toEqual(before);
    expect(await repo.db.table("photos").toArray()).toEqual(assets);
  });
  it("post-write verification failure aborts the entire restore", async () => {
    const repo = repository();
    await repo.replace(fixture());
    const before = await repo.readSnapshot();
    const hook = (photo: { bytes: Uint8Array }) => ({
      ...photo,
      bytes: new Uint8Array([1]),
    });
    repo.db.table("photos").hook("reading", hook);
    await expect(repo.restore(sample())).rejects.toThrow("Kontrola obnovy");
    repo.db.table("photos").hook("reading").unsubscribe(hook);
    expect(await repo.readSnapshot()).toEqual(before);
  });
  it("a quota failure during a normal command preserves the committed household and revision", async () => {
    const repo = repository();
    await repo.replace(sample());
    const before = await repo.readSnapshot();
    const hook = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    repo.db.table("rooms").hook("creating", hook);
    await expect(
      repo.transact((s) => {
        s.rooms[0].name = "Zmena pri plnom úložisku";
      }),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });
    repo.db.table("rooms").hook("creating").unsubscribe(hook);
    expect(await repo.readSnapshot()).toEqual(before);
    expect(balance((await repo.readSnapshot()).state)).toBe(1675);
  });
  it("invalid restore and missing photos never delete current data", async () => {
    const repo = repository(),
      s = sample();
    await repo.replace(s);
    const before = await repo.readSnapshot();
    const invalid = structuredClone(s);
    invalid.tasks[0].roomId = "missing";
    await expect(repo.restore(invalid)).rejects.toThrow();
    expect(await repo.readSnapshot()).toEqual(before);
    await repo.db.table("photos").delete(`rooms:${s.rooms[0].id}:photo`);
    await expect(repo.read()).rejects.toThrow("chýba fotografia");
    expect(await repo.db.table("rooms").count()).toBe(s.rooms.length);
  });
  it("version four migration preserves all photos and rewards and starts reminder tracking", async () => {
    const name = `legacy-photos-${uid()}`,
      old = new Dexie(name),
      s = sample();
    old.version(4).stores(Object.fromEntries(tables.map((t) => [t, "id"])));
    await old.open();
    for (const table of tables)
      if (s[table].length) await old.table(table).bulkPut(s[table]);
    old.close();
    const db = createDatabase(name);
    databases.push(db);
    const repo = new LocalRepository(db);
    expect(canonicalState(await repo.read())).toBe(canonicalState(s));
    expect(await db.table("photos").count()).toBe(2);
    expect((await repo.readSnapshot()).safety.revision).toBe(1);
    expect(db.verno).toBe(5);
  });
  it("preparation does not confirm a saved backup and unchanged reloads do not dirty data", async () => {
    const repo = repository();
    await repo.replace(fixture());
    const original = await repo.readSnapshot();
    await repo.transact(() => {});
    expect((await repo.readSnapshot()).safety.revision).toBe(
      original.safety.revision,
    );
    const prepared = await prepareBackup(original.state, original.safety, now);
    await repo.markExportPrepared(prepared.export);
    expect((await repo.readSnapshot()).safety.confirmed).toBeUndefined();
    await repo.confirmBackup(prepared.export.id);
    expect((await repo.readSnapshot()).safety.confirmed?.revision).toBe(
      original.safety.revision,
    );
    await repo.transact((s) => {
      s.rooms[0].name = "Upravená obývačka";
    });
    const changed = (await repo.readSnapshot()).safety;
    expect(changed.revision).toBe(original.safety.revision + 1);
    expect(changed.confirmed?.revision).not.toBe(changed.revision);
    await expect(repo.confirmBackup("wrong-export")).rejects.toThrow(
      "správneho súboru",
    );
  });
  it("confirms the exported revision rather than newer data changed during export", async () => {
    const repo = repository();
    await repo.replace(fixture());
    const snapshot = await repo.readSnapshot(),
      prepared = await prepareBackup(snapshot.state, snapshot.safety, now);
    await repo.transact((s) => {
      s.rooms[0].name = "Nový názov";
    });
    await repo.markExportPrepared(prepared.export);
    await repo.confirmBackup(prepared.export.id);
    const meta = (await repo.readSnapshot()).safety;
    expect(meta.confirmed?.revision).toBe(snapshot.safety.revision);
    expect(meta.confirmed?.revision).not.toBe(meta.revision);
  });
});
describe("reminders and optional browser storage", () => {
  it("reminds after seven changed days, respects confirmation, snooze and disabled reminders", () => {
    const meta = {
        ...defaultSafety(),
        revision: 4,
        dirtySince: now.toISOString(),
      },
      later = new Date(now.getTime() + 7 * 86400000);
    expect(backupReminderDue(meta, new Date(later.getTime() - 1))).toBe(false);
    expect(backupReminderDue(meta, later)).toBe(true);
    expect(
      backupReminderDue(
        {
          ...meta,
          snoozedUntil: new Date(later.getTime() + 86400000).toISOString(),
        },
        later,
      ),
    ).toBe(false);
    expect(backupReminderDue({ ...meta, reminderDays: 0 }, later)).toBe(false);
    expect(
      backupReminderDue(
        {
          ...meta,
          confirmed: {
            id: "x",
            revision: 4,
            createdAt: now.toISOString(),
            confirmedAt: now.toISOString(),
            filename: "file.zip",
          },
        },
        later,
      ),
    ).toBe(false);
  });
  it("reports quota errors and warns only when measured storage is constrained", () => {
    expect(
      storageError(new DOMException("full", "QuotaExceededError")),
    ).toContain("Uložené údaje zostali zachované");
    expect(
      storageConstrained({ usage: 90, quota: 100, persistenceSupported: true }),
    ).toBe(true);
    expect(storageConstrained({ persistenceSupported: false })).toBe(false);
  });
  it("native share cancellation does not count as delivery", async () => {
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: () => Promise.reject(new DOMException("cancel", "AbortError")),
    });
    expect(await shareBackup(new File(["data"], "file.zip"))).toBe("cancelled");
  });
  it("keeps unavailable, denied and granted persistence distinct", async () => {
    vi.stubGlobal("navigator", {});
    expect(await storageStatus()).toEqual({
      persistenceSupported: false,
      persistent: undefined,
    });
    expect(await requestPersistentStorage()).toBeUndefined();
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => ({ usage: 600, quota: 1000 }),
        persisted: async () => false,
        persist: async () => false,
      },
    });
    expect(await storageStatus()).toEqual({
      usage: 600,
      quota: 1000,
      persistent: false,
      persistenceSupported: true,
    });
    expect(await requestPersistentStorage()).toBe(false);
    vi.stubGlobal("navigator", {
      storage: { persist: async () => true, persisted: async () => true },
    });
    expect(await requestPersistentStorage()).toBe(true);
    expect((await storageStatus()).persistent).toBe(true);
    vi.stubGlobal("navigator", {
      storage: {
        persist: async () => {
          throw new Error("denied");
        },
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
