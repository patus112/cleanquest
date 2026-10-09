import {
  zip,
  unzip,
  unzipSync,
  strToU8,
  strFromU8,
  type Zippable,
} from "fflate";
import { z } from "zod";
import { version as applicationVersion } from "../../package.json";
import { tables, uid, type State } from "../domain/model";
import type { LocalSafety, PreparedExport } from "../domain/localSafety";
import { importBackup, validateState } from "./validation";
import { mapPhotos, decodePhoto, photoUrl } from "./photos";
import { DATABASE_VERSION } from "./repository";

export const MAX_ARCHIVE_BYTES = 40000000;
const MAX_FILES = 1002;
const hashPattern = /^[a-f0-9]{64}$/;
const photoPath = /^photos\/\d{4}\.(png|jpg|webp)$/;
const integer = z.number().int().safe().min(0);
const reminderDays = z.union([
  z.literal(0),
  z.literal(3),
  z.literal(7),
  z.literal(14),
  z.literal(30),
]);
const manifestSchema = z
  .object({
    format: z.literal("cleanquest-zip"),
    formatVersion: z.literal(1),
    dataSchemaVersion: z.literal(2),
    databaseVersion: integer,
    applicationVersion: z.string().min(1).max(100),
    createdAt: z.iso.datetime(),
    householdId: z.string().min(1).max(200).nullable(),
    dataRevision: integer,
    records: z.record(z.string(), integer),
    photoCount: integer.max(1000),
    photos: z
      .array(
        z
          .object({
            path: z.string().regex(photoPath),
            mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
            bytes: integer.max(2000000),
          })
          .strict(),
      )
      .max(1000),
    checksums: z.record(z.string(), z.string().regex(hashPattern)),
    manifestSha256: z.string().regex(hashPattern),
  })
  .strict();
const exportMetadata = z
  .object({
    id: z.string().min(1).max(200),
    revision: integer,
    createdAt: z.iso.datetime(),
    filename: z.string().min(1).max(300),
  })
  .strict();
const safetySchema = z
  .object({
    id: z.literal("local"),
    revision: integer,
    reminderDays,
    dirtySince: z.iso.datetime().optional(),
    lastChangedAt: z.iso.datetime().optional(),
    lastExport: exportMetadata.optional(),
    confirmed: exportMetadata
      .extend({ confirmedAt: z.iso.datetime() })
      .optional(),
    snoozedUntil: z.iso.datetime().optional(),
    lastRestoredAt: z.iso.datetime().optional(),
  })
  .strict()
  .refine(
    (meta) =>
      (!meta.lastExport || meta.lastExport.revision <= meta.revision) &&
      (!meta.confirmed || meta.confirmed.revision <= meta.revision),
  );
export type BackupManifest = z.infer<typeof manifestSchema>;
export interface ValidatedBackup {
  data: State;
  exportedAt: string;
  reminderDays: LocalSafety["reminderDays"];
  photoCount: number;
  verified: boolean;
  manifest?: BackupManifest;
  sourceSafety?: LocalSafety;
}
export interface PreparedBackup {
  file: File;
  export: PreparedExport;
  manifest: BackupManifest;
}
export async function checksum(bytes: Uint8Array) {
  if (!crypto.subtle)
    throw new Error(
      "Kontrola zálohy vyžaduje bezpečné HTTPS pripojenie alebo lokálny náhľad.",
    );
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
  );
  return Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
}
function validRaster(mime: string, b: Uint8Array) {
  const valid =
    mime === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n)
      : mime === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : strFromU8(b.subarray(0, 4)) === "RIFF" &&
          strFromU8(b.subarray(8, 12)) === "WEBP";
  if (!valid || !b.length || b.length > 2000000)
    throw new Error("Záloha obsahuje poškodenú alebo príliš veľkú fotografiu.");
}
export async function prepareBackup(
  state: State,
  safety: LocalSafety,
  now = new Date(),
): Promise<PreparedBackup> {
  const data = structuredClone(validateState(state)),
    createdAt = now.toISOString(),
    files: Zippable = {},
    photos: BackupManifest["photos"] = [],
    dedup = new Map<string, string>();
  // The data model keeps display URLs; the ZIP and database store raster bytes separately.
  const attachments: { value: string; key: string }[] = [];
  mapPhotos(data, (value, key) => {
    attachments.push({ value, key });
    return value;
  });
  const paths = new Map<string, string>(),
    checksums: Record<string, string> = {};
  for (const attachment of attachments) {
    const photo = decodePhoto(attachment.value);
    validRaster(photo.mime, photo.bytes);
    const hash = await checksum(photo.bytes),
      signature = `${photo.mime}:${hash}`;
    let path = dedup.get(signature);
    if (!path) {
      if (photos.length >= 1000)
        throw new Error("Záloha môže obsahovať najviac 1 000 fotografií.");
      const ext = photo.mime === "image/jpeg" ? "jpg" : photo.mime.slice(6);
      path = `photos/${String(photos.length + 1).padStart(4, "0")}.${ext}`;
      photos.push({ path, mime: photo.mime, bytes: photo.bytes.length });
      files[path] = [photo.bytes, { level: 0 }]; // Already optimized raster images need no further compression.
      checksums[path] = hash;
      dedup.set(signature, path);
    }
    paths.set(attachment.key, path);
  }
  mapPhotos(data, (_, key) => `backup-photo:${paths.get(key)}`);
  const dataBytes = strToU8(
    JSON.stringify({
      format: "cleanquest-data",
      schemaVersion: 2,
      data,
      preferences: { reminderDays: safety.reminderDays },
      backupMetadata: safety,
    }),
  );
  files["data.json"] = dataBytes;
  checksums["data.json"] = await checksum(dataBytes);
  const unsigned = {
    format: "cleanquest-zip" as const,
    formatVersion: 1 as const,
    dataSchemaVersion: 2 as const,
    databaseVersion: DATABASE_VERSION,
    applicationVersion,
    createdAt,
    householdId: state.households[0]?.id || null,
    dataRevision: safety.revision,
    records: Object.fromEntries(tables.map((t) => [t, data[t].length])),
    photoCount: photos.length,
    photos,
    checksums,
  };
  const manifest: BackupManifest = {
    ...unsigned,
    manifestSha256: await checksum(strToU8(JSON.stringify(unsigned))),
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  const archive = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (err, result) =>
      err ? reject(err) : resolve(result),
    ),
  );
  if (archive.length > MAX_ARCHIVE_BYTES)
    throw new Error("Záloha prekračuje limit 40 MB. Zmenši počet fotografií.");
  const local = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    ).toISOString(),
    filename = `cleanquest-backup-${local.slice(0, 10)}-${local.slice(11, 16).replace(":", "")}.zip`;
  return {
    file: new File([new Uint8Array(archive).buffer], filename, {
      type: "application/zip",
    }),
    manifest,
    export: { id: uid(), revision: safety.revision, createdAt, filename },
  };
}
export function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error("Súbor sa nepodarilo načítať."));
    reader.readAsArrayBuffer(file);
  });
}
function parseJson(bytes: Uint8Array) {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error("Záloha obsahuje poškodený JSON súbor.");
  }
}
export async function validateArchive(
  bytes: Uint8Array,
): Promise<ValidatedBackup> {
  if (!bytes.length || bytes.length > MAX_ARCHIVE_BYTES)
    throw new Error("ZIP záloha môže mať najviac 40 MB.");
  const names = new Set<string>();
  let expanded = 0;
  try {
    // Preflight every central-directory entry before any decompression; reject duplicates and zip bombs.
    unzipSync(bytes, {
      filter: (entry) => {
        if (
          names.has(entry.name) ||
          names.size >= MAX_FILES ||
          (!["manifest.json", "data.json"].includes(entry.name) &&
            !photoPath.test(entry.name)) ||
          ![0, 8].includes(entry.compression) ||
          !Number.isSafeInteger(entry.originalSize) ||
          entry.originalSize < 0
        )
          throw new Error(
            "Neplatná štruktúra ZIP zálohy alebo duplicitné súbory.",
          );
        names.add(entry.name);
        expanded += entry.originalSize;
        if (
          expanded > MAX_ARCHIVE_BYTES ||
          entry.originalSize >
            (entry.name === "data.json"
              ? 30000000
              : entry.name === "manifest.json"
                ? 500000
                : 2000000)
        )
          throw new Error("Rozbalená záloha je príliš veľká.");
        return false;
      },
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && /záloh/.test(err.message)
        ? err.message
        : "Súbor nie je platný ZIP archív.",
    );
  }
  if (!names.has("manifest.json") || !names.has("data.json"))
    throw new Error("V zálohe chýba manifest.json alebo data.json.");
  const files = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) =>
      unzip(bytes, (err, result) =>
        err ? reject(new Error("ZIP záloha je poškodená.")) : resolve(result),
      ),
  );
  const raw = parseJson(files["manifest.json"]);
  if (
    raw?.formatVersion !== 1 ||
    raw?.dataSchemaVersion !== 2 ||
    raw?.databaseVersion > DATABASE_VERSION
  )
    throw new Error("Táto verzia zálohy zatiaľ nie je podporovaná.");
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Manifest zálohy má neplatný formát.");
  const manifest = parsed.data,
    { manifestSha256, ...unsigned } = manifest;
  if ((await checksum(strToU8(JSON.stringify(unsigned)))) !== manifestSha256)
    throw new Error(
      "Kontrolný súčet manifestu nesúhlasí. Záloha môže byť poškodená.",
    );
  const expected = new Set([
    "data.json",
    ...manifest.photos.map((p) => p.path),
  ]);
  for (const path of expected)
    if (!files[path])
      throw new Error("V zálohe chýba fotografia alebo dátový súbor.");
  if (
    manifest.photoCount !== manifest.photos.length ||
    expected.size !== manifest.photos.length + 1 ||
    names.size !== expected.size + 1 ||
    Object.keys(manifest.checksums).length !== expected.size
  )
    throw new Error("Počty súborov alebo fotografií v zálohe nesúhlasia.");
  for (const path of expected) {
    if ((await checksum(files[path])) !== manifest.checksums[path])
      throw new Error(
        "Kontrolný súčet zálohy nesúhlasí. Pôvodné údaje neboli zmenené.",
      );
  }
  const envelope = z
    .object({
      format: z.literal("cleanquest-data"),
      schemaVersion: z.literal(2),
      data: z.unknown(),
      preferences: z.object({ reminderDays }).strict(),
      backupMetadata: safetySchema.optional(),
    })
    .strict()
    .safeParse(parseJson(files["data.json"]));
  if (!envelope.success)
    throw new Error("Dátový súbor zálohy má neplatný formát alebo verziu.");
  if (
    envelope.data.backupMetadata &&
    (envelope.data.backupMetadata.revision !== manifest.dataRevision ||
      envelope.data.backupMetadata.reminderDays !==
        envelope.data.preferences.reminderDays)
  )
    throw new Error("História zálohovania v archíve nesúhlasí.");
  const payload = envelope.data.data;
  // Validate table containers before walking attachment fields; full schema/relationship validation follows hydration.
  if (
    !payload ||
    typeof payload !== "object" ||
    tables.some((t) => !Array.isArray((payload as State)[t]))
  )
    throw new Error("V zálohe chýbajú povinné záznamy.");
  const data = structuredClone(payload) as State,
    byPath = new Map(manifest.photos.map((p) => [p.path, p])),
    used = new Set<string>();
  try {
    mapPhotos(data, (value) => {
      if (typeof value !== "string" || !value.startsWith("backup-photo:"))
        throw new Error("Neplatný odkaz na fotografiu.");
      const path = value.slice(13),
        photo = byPath.get(path);
      if (!photo || !files[path] || photo.bytes !== files[path].length)
        throw new Error(
          "V zálohe chýba fotografia alebo nesúhlasí jej veľkosť.",
        );
      const extension =
        photo.mime === "image/jpeg" ? "jpg" : photo.mime.slice(6);
      if (!path.endsWith(`.${extension}`))
        throw new Error("Neplatný typ fotografie.");
      validRaster(photo.mime, files[path]);
      used.add(path);
      return photoUrl({ mime: photo.mime, bytes: files[path] });
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && !(err instanceof TypeError)
        ? err.message
        : "Záloha obsahuje neplatné záznamy fotografií.",
    );
  }
  const valid = validateState(data);
  if (
    used.size !== manifest.photoCount ||
    manifest.householdId !== (valid.households[0]?.id || null) ||
    Object.keys(manifest.records).length !== tables.length ||
    tables.some((t) => manifest.records[t] !== valid[t].length)
  )
    throw new Error("Počty záznamov alebo domácnosť v zálohe nesúhlasia.");
  return {
    data: valid,
    exportedAt: manifest.createdAt,
    reminderDays: envelope.data.preferences.reminderDays,
    photoCount: manifest.photoCount,
    verified: true,
    manifest,
    sourceSafety: envelope.data.backupMetadata,
  };
}
export async function openBackup(file: File): Promise<ValidatedBackup> {
  if (!file.size || file.size > MAX_ARCHIVE_BYTES)
    throw new Error("Záloha môže mať najviac 40 MB.");
  const bytes = await readFileBytes(file);
  if (bytes[0] === 80 && bytes[1] === 75) return validateArchive(bytes);
  const legacy = importBackup(strFromU8(bytes));
  let photoCount = 0;
  mapPhotos(structuredClone(legacy.data), (value) => {
    const photo = decodePhoto(value);
    validRaster(photo.mime, photo.bytes);
    photoCount++;
    return value;
  });
  return {
    data: legacy.data,
    exportedAt: legacy.exportedAt,
    reminderDays: 7,
    photoCount,
    verified: false,
  };
}
