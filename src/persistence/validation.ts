import { z } from "zod";
import { type State, xpFor } from "../domain/model";
const id = z.string().min(1).max(200),
  text = z.string().max(10000),
  title = z.string().trim().min(1).max(300);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const timestamp = z.iso.datetime();
const integer = z.number().int().safe();
const cents = integer.min(0).max(100000000);
const photo = z
  .string()
  .max(3000000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
const owned = { id, householdId: id };
const flooring = z.enum(["tile", "laminate", "carpet", "wood", "other"]);
const area = z.number().positive().max(100000).optional();
const recurrence = z.object({
  unit: z.enum(["day", "week", "month", "year", "once"]),
  interval: integer.min(1).max(3660),
  strategy: z.enum(["completion", "calendar"]),
  anchor: day,
  preferredDay: integer.min(0).max(6).optional(),
});
const step = z.object({
  id,
  title,
  done: z.boolean(),
  duration: integer.min(1).max(10),
});
const occurrence = z.object({
  id,
  taskId: id,
  roomId: id,
  roomName: title,
  objectId: id.optional(),
  objectName: title.optional(),
  title,
  instructions: text,
  duration: integer.min(1).max(120),
  xp: integer.min(0).max(50),
  date: day,
  status: z.enum(["pending", "skipped"]),
  deferredTo: day.optional(),
});
const schema = z
  .object({
    profiles: z
      .array(z.object({ id, displayName: title, createdAt: timestamp }))
      .max(1),
    households: z
      .array(
        z.object({
          id,
          name: title,
          type: z.enum(["apartment", "house"]),
          totalArea: z.number().min(0).max(100000),
          residentCount: integer.min(1).max(100),
          children: z.boolean(),
          pets: z.boolean(),
          timezone: title.refine((v) => {
            try {
              new Intl.DateTimeFormat("sk", { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }),
          createdAt: timestamp,
        }),
      )
      .max(1),
    floors: z.array(z.object({ ...owned, name: title, order: integer.min(0) })),
    rooms: z.array(
      z.object({
        ...owned,
        floorId: id,
        name: title,
        category: z.enum([
          "kitchen",
          "bathroom",
          "toilet",
          "bedroom",
          "child",
          "playroom",
          "living",
          "dining",
          "hallway",
          "stairs",
          "terrace",
          "storage",
          "laundry",
          "other",
        ]),
        area: z.number().positive().optional(),
        flooring,
        floorSurfaces: z
          .array(z.object({ material: flooring, area }))
          .max(5)
          .optional(),
        width: z.number().positive().max(1000).optional(),
        length: z.number().positive().max(1000).optional(),
        windowArea: z.number().min(0).max(100000).optional(),
        curtains: z.boolean().optional(),
        blinds: z.boolean().optional(),
        order: integer.min(0),
        enabled: z.boolean(),
        zones: z.array(title).max(100),
        photo: photo.optional(),
      }),
    ),
    objects: z.array(
      z.object({
        ...owned,
        roomId: id,
        name: title,
        category: z.enum([
          "door",
          "cabinet",
          "drawer",
          "shelf",
          "bench",
          "toilet",
          "sink",
          "tap",
          "mirror",
          "bathtub",
          "shower",
          "island",
          "worktop",
          "hood",
          "hob",
          "fridge",
          "oven",
          "dishwasher",
          "microwave",
          "bin",
          "sofa",
          "tv",
          "table",
          "speaker",
          "glass",
          "curtain",
          "blind",
          "chair",
          "carpet",
          "bed",
          "wardrobe",
          "toy",
          "washer",
          "dryer",
          "rail",
          "floor",
          "switch",
          "custom",
        ]),
        quantity: integer.min(1).max(1000),
        dimensions: text,
        area,
        position: z
          .object({
            x: z.number().min(10).max(90),
            y: z.number().min(12).max(88),
          })
          .optional(),
        surface: text,
        accessibility: z.enum(["safe", "unsafe"]),
        photo: photo.optional(),
        notes: text,
      }),
    ),
    tasks: z.array(
      z.object({
        ...owned,
        roomId: id,
        objectId: id.optional(),
        templateId: id.optional(),
        title,
        instructions: text,
        duration: integer.min(1).max(120),
        recurrence,
        priority: integer.min(1).max(3),
        energy: integer.min(1).max(3),
        difficulty: integer.min(1).max(3).optional(),
        supplies: z.array(text),
        enabled: z.boolean(),
        nextDue: day,
        lastCompleted: day.optional(),
        workflow: z.literal("wash").optional(),
        eventAt: timestamp.optional(),
        parentCompletionId: id.optional(),
        acceptedLong: z.boolean(),
      }),
    ),
    completions: z.array(
      z.object({
        ...owned,
        taskId: id,
        occurrenceId: id,
        title,
        roomName: title,
        duration: integer.min(1).max(120),
        completedAt: timestamp,
        day,
        type: z.enum(["required", "extra", "manual"]),
        xp: integer.min(0).max(50),
        previousDue: day,
        nextDue: day,
        undone: z.boolean(),
      }),
    ),
    dailyPlans: z.array(
      z.object({
        ...owned,
        date: day,
        occurrences: z.array(occurrence),
        timeBudget: integer.min(5).max(30),
        lockedAt: timestamp,
      }),
    ),
    weeks: z.array(
      z.object({
        ...owned,
        start: day,
        end: day,
        required: z.array(occurrence),
        rewardCents: integer.min(0).max(2000),
        rewardEnabled: z.boolean(),
        restDays: z.array(integer.min(0).max(6)).max(7).default([]),
        rewardIssuedAt: timestamp.optional(),
        lockedAt: timestamp,
      }),
    ),
    bonuses: z.array(
      z.object({
        ...owned,
        week: day,
        title,
        steps: z.array(step).min(1).max(7),
        rewardCents: integer.min(0).max(500),
        monetaryEnabled: z.boolean(),
        awarded: z.boolean(),
        variant: integer.min(0),
      }),
    ),
    megas: z.array(
      z.object({
        ...owned,
        month: z.string().regex(/^\d{4}-\d{2}$/),
        problemId: id.optional(),
        title,
        problem: text,
        result: text,
        solution: text,
        materials: text,
        budgetCents: cents,
        steps: z.array(step).min(3).max(7),
        before: photo.optional(),
        after: photo.optional(),
        awarded: z.boolean(),
      }),
    ),
    problems: z.array(
      z.object({
        ...owned,
        roomId: z.string(),
        objectId: id.optional(),
        title,
        description: text,
        category: z.enum([
          "Zorganizovať",
          "Opraviť",
          "Vymeniť",
          "Prerobiť",
          "Vymyslieť riešenie",
          "Dokončiť",
        ]),
        priority: integer.min(1).max(3),
        status: z.enum([
          "Nové",
          "Na premyslenie",
          "Pripravené",
          "Rozpracované",
          "Čaká na materiál",
          "Vyriešené",
          "Odložené",
        ]),
        budgetCents: cents,
        notes: text,
        solution: text,
        steps: z.array(step).max(30),
        photos: z.array(photo).max(10),
        createdAt: timestamp,
        completedAt: timestamp.optional(),
      }),
    ),
    rewards: z.array(
      z.object({
        ...owned,
        type: z.enum(["weekly", "bonus", "correction", "redemption"]),
        cents: integer.min(-100000000).max(2500),
        sourceId: id,
        createdAt: timestamp,
        description: title,
      }),
    ),
    achievements: z.array(z.object({ ...owned, title, unlockedAt: timestamp })),
    wishes: z.array(z.object({ ...owned, title, cents, redeemedCents: cents })),
    settings: z
      .array(
        z.object({
          id,
          theme: z.enum(["dark", "light", "system"]),
          dailyBudget: z.union([
            z.literal(5),
            z.literal(10),
            z.literal(15),
            z.literal(20),
            z.literal(30),
          ]),
          restDays: z.array(integer.min(0).max(6)).max(7),
          intensity: z.enum(["gentle", "balanced", "active"]),
          energy: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          monetary: z.boolean(),
          weeklyCents: integer.min(0).max(2000),
          bonusCents: integer.min(0).max(500),
          haptics: z.boolean(),
          specialNeeds: text,
        }),
      )
      .max(1),
  })
  .strict();
export function validateState(input: unknown): State {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Error("Záloha má neplatný formát alebo chýbajúce údaje.");
  const s: State = parsed.data;
  const fail = () => {
    throw new Error("Údaje obsahujú neplatné vzťahy alebo duplicitné záznamy.");
  };
  for (const arr of Object.values(s)) {
    if (new Set(arr.map((x: { id: string }) => x.id)).size !== arr.length)
      fail();
  }
  if (!s.households.length) {
    if (Object.values(s).some((a) => a.length)) fail();
    return s;
  }
  if (s.settings.length !== 1 || s.profiles.length !== 1 || !s.floors.length)
    fail();
  const hid = s.households[0].id;
  for (const arr of Object.values(s))
    for (const row of arr)
      if ("householdId" in row && row.householdId !== hid) fail();
  for (const r of s.rooms)
    if (!s.floors.some((f) => f.id === r.floorId)) fail();
  for (const o of s.objects)
    if (!s.rooms.some((r) => r.id === o.roomId)) fail();
  for (const t of s.tasks) {
    if (
      !s.rooms.some((r) => r.id === t.roomId) ||
      (t.objectId &&
        !s.objects.some((o) => o.id === t.objectId && o.roomId === t.roomId)) ||
      (t.duration > 10 && !t.acceptedLong)
    )
      fail();
    if (
      t.parentCompletionId &&
      !s.completions.some((c) => c.id === t.parentCompletionId)
    )
      fail();
  }
  for (const p of s.problems)
    if (
      (p.roomId && !s.rooms.some((r) => r.id === p.roomId)) ||
      (p.objectId &&
        !s.objects.some((o) => o.id === p.objectId && o.roomId === p.roomId))
    )
      fail();
  for (const m of s.megas)
    if (m.problemId && !s.problems.some((p) => p.id === m.problemId)) fail();
  const occurrences = s.dailyPlans.flatMap((p) => p.occurrences);
  if (
    new Set(occurrences.map((o) => o.id)).size !== occurrences.length ||
    new Set(s.dailyPlans.map((p) => p.date)).size !== s.dailyPlans.length ||
    new Set(s.weeks.map((w) => w.start)).size !== s.weeks.length ||
    new Set(s.bonuses.map((b) => b.week)).size !== s.bonuses.length ||
    new Set(s.megas.map((m) => m.month)).size !== s.megas.length
  )
    fail();
  for (const w of s.weeks)
    for (const o of w.required) {
      const original = occurrences.find((x) => x.id === o.id);
      if (
        !original ||
        original.taskId !== o.taskId ||
        original.duration !== o.duration ||
        o.date < w.start ||
        o.date > w.end
      )
        fail();
    }
  const active = s.completions.filter((c) => !c.undone);
  if (new Set(active.map((c) => c.occurrenceId)).size !== active.length) fail();
  for (const c of s.completions) {
    if (c.xp !== (c.type === "extra" ? 0 : xpFor(c.duration))) fail();
    if (
      c.type === "required" &&
      !occurrences.some((o) => o.id === c.occurrenceId)
    )
      fail();
  }
  for (const d of new Set(active.map((c) => c.day))) {
    const extras = active.filter((c) => c.day === d && c.type === "extra");
    if (
      extras.length > 2 ||
      extras.reduce((n, c) => n + c.duration, 0) > 10 ||
      extras.some((c) => c.xp !== 0)
    )
      fail();
  }
  for (const r of s.rewards) {
    if (
      (r.type === "redemption" && r.cents >= 0) ||
      (r.type === "correction" && r.cents >= 0) ||
      (["weekly", "bonus"].includes(r.type) && r.cents <= 0)
    )
      fail();
    if (
      r.type !== "redemption" &&
      !s.weeks.some((w) => w.id === r.sourceId) &&
      !s.bonuses.some((b) => b.id === r.sourceId)
    )
      fail();
  }
  if (JSON.stringify(s).length > 30000000)
    throw new Error(
      "Fotografie a údaje prekračujú kapacitu zálohy 30 MB. Odstráň niektoré fotografie.",
    );
  return s;
}
export interface Backup {
  format: "cleanquest";
  version: 2;
  exportedAt: string;
  data: State;
}
export function exportBackup(s: State): string {
  return JSON.stringify(
    {
      format: "cleanquest",
      version: 2,
      exportedAt: new Date().toISOString(),
      data: validateState(s),
    },
    null,
    2,
  );
}
export function importBackup(json: string): Backup {
  if (json.length > 30000000)
    throw new Error("Záloha je príliš veľká (limit 30 MB).");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Súbor nie je platný JSON.");
  }
  const envelope = z
    .object({
      format: z.literal("cleanquest"),
      version: integer,
      exportedAt: timestamp,
      data: z.unknown(),
    })
    .safeParse(value);
  if (!envelope.success)
    throw new Error("Tento súbor nie je záloha CleanQuest.");
  if (![1, 2].includes(envelope.data.version))
    throw new Error("Táto verzia zálohy zatiaľ nie je podporovaná.");
  return {
    format: "cleanquest",
    version: 2,
    exportedAt: envelope.data.exportedAt,
    data: validateState(envelope.data.data),
  };
}
