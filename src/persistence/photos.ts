import type { State } from "../domain/model";
export interface StoredPhoto {
  id: string;
  mime: string;
  bytes: Uint8Array;
}
export const photoAttachmentCount = (state: State) =>
  state.rooms.filter((r) => r.photo).length +
  state.objects.filter((o) => o.photo).length +
  state.problems.reduce((n, p) => n + p.photos.length, 0) +
  state.megas.reduce((n, m) => n + Number(!!m.before) + Number(!!m.after), 0);
export function mapPhotos(
  state: State,
  map: (value: string, key: string) => string,
) {
  for (const table of ["rooms", "objects"] as const)
    for (const row of state[table])
      if (row.photo) row.photo = map(row.photo, `${table}:${row.id}:photo`);
  for (const row of state.problems)
    row.photos = row.photos.map((p, i) => map(p, `problems:${row.id}:${i}`));
  for (const row of state.megas)
    for (const field of ["before", "after"] as const)
      if (row[field]) row[field] = map(row[field]!, `megas:${row.id}:${field}`);
}
export function decodePhoto(url: string): {
  mime: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
} {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!match) throw new Error("Fotografia má neplatný formát.");
  let raw: string;
  try {
    raw = atob(match[2]);
  } catch {
    throw new Error("Fotografia je poškodená.");
  }
  return {
    mime: match[1] as "image/png" | "image/jpeg" | "image/webp",
    bytes: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
  };
}
export function photoUrl(photo: Pick<StoredPhoto, "mime" | "bytes">) {
  let raw = "";
  for (let i = 0; i < photo.bytes.length; i += 8192)
    raw += String.fromCharCode(...photo.bytes.subarray(i, i + 8192));
  return `data:${photo.mime};base64,${btoa(raw)}`;
}
export function storePhotos(input: State) {
  const state = structuredClone(input),
    photos: StoredPhoto[] = [];
  mapPhotos(state, (value, id) => {
    photos.push({ id, ...decodePhoto(value) });
    return `local-photo:${id}`;
  });
  return { state, photos };
}
export function hydratePhotos(state: State, photos: StoredPhoto[]) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  mapPhotos(state, (value) => {
    if (!value.startsWith("local-photo:")) return value; // Legacy databases remain readable during upgrades.
    const photo = byId.get(value.slice(12));
    if (!photo)
      throw new Error(
        "V miestnom úložisku chýba fotografia. Údaje neboli vymazané; obnov ich z overenej zálohy.",
      );
    return photoUrl(photo);
  });
  return state;
}
export async function optimizePhoto(file: File): Promise<string> {
  if (
    file.size > 20000000 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("Vyber fotografiu PNG, JPEG alebo WebP do 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Fotografiu sa nepodarilo otvoriť."));
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60000000
    )
      throw new Error("Fotografia má príliš veľké alebo neplatné rozmery.");
    const scale = Math.min(
        1,
        1600 / Math.max(image.naturalWidth, image.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Prehliadač nevie pripraviť fotografiu.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.65, 0.45]) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (result.startsWith("data:image/jpeg;") && result.length <= 2600000)
        return result;
    }
    throw new Error(
      "Fotografia je po úprave stále príliš veľká. Vyber menší obrázok.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
