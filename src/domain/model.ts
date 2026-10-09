export type Day = string;
export type RoomCategory =
  | "kitchen"
  | "bathroom"
  | "toilet"
  | "bedroom"
  | "child"
  | "playroom"
  | "living"
  | "dining"
  | "hallway"
  | "stairs"
  | "terrace"
  | "storage"
  | "laundry"
  | "other";
export const roomLabels: Record<RoomCategory, string> = {
  kitchen: "Kuchyňa",
  bathroom: "Kúpeľňa",
  toilet: "Toaleta",
  bedroom: "Spálňa",
  child: "Detská izba",
  playroom: "Herňa",
  living: "Obývačka",
  dining: "Jedáleň",
  hallway: "Chodba",
  stairs: "Schodisko",
  terrace: "Terasa / balkón",
  storage: "Úložný priestor",
  laundry: "Práčovňa",
  other: "Iná miestnosť",
};
export type ObjectCategory =
  | "door"
  | "cabinet"
  | "drawer"
  | "shelf"
  | "bench"
  | "toilet"
  | "sink"
  | "tap"
  | "mirror"
  | "bathtub"
  | "shower"
  | "island"
  | "worktop"
  | "hood"
  | "hob"
  | "fridge"
  | "oven"
  | "dishwasher"
  | "microwave"
  | "bin"
  | "sofa"
  | "tv"
  | "table"
  | "speaker"
  | "glass"
  | "curtain"
  | "blind"
  | "chair"
  | "carpet"
  | "bed"
  | "wardrobe"
  | "toy"
  | "washer"
  | "dryer"
  | "rail"
  | "floor"
  | "switch"
  | "custom";
export const objectLabels: Record<ObjectCategory, string> = {
  door: "Dvere",
  cabinet: "Skrinka",
  drawer: "Zásuvka",
  shelf: "Polica",
  bench: "Lavica",
  toilet: "WC",
  sink: "Umývadlo / drez",
  tap: "Batéria",
  mirror: "Zrkadlo",
  bathtub: "Vaňa",
  shower: "Sprcha",
  island: "Ostrovček",
  worktop: "Pracovná doska",
  hood: "Digestor",
  hob: "Varná doska",
  fridge: "Chladnička",
  oven: "Rúra",
  dishwasher: "Umývačka",
  microwave: "Mikrovlnka",
  bin: "Kôš",
  sofa: "Pohovka",
  tv: "Televízor",
  table: "Stôl",
  speaker: "Reproduktor",
  glass: "Sklenený panel",
  curtain: "Záves",
  blind: "Žalúzie",
  chair: "Stolička",
  carpet: "Koberec",
  bed: "Posteľ",
  wardrobe: "Skriňa",
  toy: "Hračky",
  washer: "Práčka",
  dryer: "Sušička",
  rail: "Zábradlie",
  floor: "Podlaha",
  switch: "Vypínač",
  custom: "Vlastný predmet",
};
export interface Recurrence {
  unit: "day" | "week" | "month" | "year" | "once";
  interval: number;
  strategy: "completion" | "calendar";
  anchor: Day;
  preferredDay?: number;
}
export interface Profile {
  id: string;
  displayName: string;
  createdAt: string;
}
export interface Household {
  id: string;
  name: string;
  type: "apartment" | "house";
  totalArea: number;
  residentCount: number;
  children: boolean;
  pets: boolean;
  timezone: string;
  createdAt: string;
}
export interface Floor {
  id: string;
  householdId: string;
  name: string;
  order: number;
}
export type FlooringType = "tile" | "laminate" | "carpet" | "wood" | "other";
export const flooringLabels: Record<FlooringType, string> = {
  tile: "Dlažba",
  laminate: "Plávajúca podlaha / laminát",
  carpet: "Koberec",
  wood: "Drevená podlaha",
  other: "Iný materiál",
};
export interface Room {
  id: string;
  householdId: string;
  floorId: string;
  name: string;
  category: RoomCategory;
  area?: number;
  flooring: FlooringType;
  floorSurfaces?: { material: FlooringType; area?: number }[];
  width?: number;
  length?: number;
  windowArea?: number;
  curtains?: boolean;
  blinds?: boolean;
  order: number;
  enabled: boolean;
  zones: string[];
  photo?: string;
}
export interface Inventory {
  id: string;
  householdId: string;
  roomId: string;
  name: string;
  category: ObjectCategory;
  quantity: number;
  dimensions: string;
  area?: number;
  position?: { x: number; y: number };
  surface: string;
  accessibility: "safe" | "unsafe";
  photo?: string;
  notes: string;
}
export interface TaskTemplate {
  id: string;
  title: string;
  instructions: string;
  roomTypes: RoomCategory[];
  objectTypes: ObjectCategory[];
  duration: number;
  recurrence: Omit<Recurrence, "anchor">;
  priority: number;
  energy: number;
  xp: number;
  supplies: string[];
  workflow?: "wash";
}
export interface Task {
  id: string;
  householdId: string;
  roomId: string;
  objectId?: string;
  templateId?: string;
  title: string;
  instructions: string;
  duration: number;
  recurrence: Recurrence;
  priority: number;
  energy: number;
  difficulty?: number;
  supplies: string[];
  enabled: boolean;
  nextDue: Day;
  lastCompleted?: Day;
  workflow?: "wash";
  eventAt?: string;
  parentCompletionId?: string;
  acceptedLong: boolean;
}
export interface Occurrence {
  id: string;
  taskId: string;
  roomId: string;
  roomName: string;
  objectId?: string;
  objectName?: string;
  title: string;
  instructions: string;
  duration: number;
  xp: number;
  date: Day;
  status: "pending" | "skipped";
  deferredTo?: Day;
}
export interface DailyPlan {
  id: string;
  householdId: string;
  date: Day;
  occurrences: Occurrence[];
  timeBudget: number;
  lockedAt: string;
}
export interface WeeklyPlan {
  id: string;
  householdId: string;
  start: Day;
  end: Day;
  required: Occurrence[];
  rewardCents: number;
  rewardEnabled: boolean;
  restDays: number[];
  rewardIssuedAt?: string;
  lockedAt: string;
}
export interface Completion {
  id: string;
  householdId: string;
  taskId: string;
  occurrenceId: string;
  title: string;
  roomName: string;
  duration: number;
  completedAt: string;
  day: Day;
  type: "required" | "extra" | "manual";
  xp: number;
  previousDue: Day;
  nextDue: Day;
  undone: boolean;
}
export interface Step {
  id: string;
  title: string;
  done: boolean;
  duration: number;
}
export interface Bonus {
  id: string;
  householdId: string;
  week: string;
  title: string;
  steps: Step[];
  rewardCents: number;
  monetaryEnabled: boolean;
  awarded: boolean;
  variant: number;
}
export interface Mega {
  id: string;
  householdId: string;
  month: string;
  problemId?: string;
  title: string;
  problem: string;
  result: string;
  solution: string;
  materials: string;
  budgetCents: number;
  steps: Step[];
  before?: string;
  after?: string;
  awarded: boolean;
}
export type ProblemCategory =
  | "Zorganizovať"
  | "Opraviť"
  | "Vymeniť"
  | "Prerobiť"
  | "Vymyslieť riešenie"
  | "Dokončiť";
export const problemStatuses = [
  "Nové",
  "Na premyslenie",
  "Pripravené",
  "Rozpracované",
  "Čaká na materiál",
  "Vyriešené",
  "Odložené",
] as const;
export interface Problem {
  id: string;
  householdId: string;
  roomId: string;
  objectId?: string;
  title: string;
  description: string;
  category: ProblemCategory;
  priority: number;
  status: (typeof problemStatuses)[number];
  budgetCents: number;
  notes: string;
  solution: string;
  steps: Step[];
  photos: string[];
  createdAt: string;
  completedAt?: string;
}
export interface Reward {
  id: string;
  householdId: string;
  type: "weekly" | "bonus" | "correction" | "redemption";
  cents: number;
  sourceId: string;
  createdAt: string;
  description: string;
}
export interface Achievement {
  id: string;
  householdId: string;
  title: string;
  unlockedAt: string;
}
export interface Wish {
  id: string;
  householdId: string;
  title: string;
  cents: number;
  redeemedCents: number;
}
export interface Settings {
  id: string;
  theme: "dark" | "light" | "system";
  dailyBudget: 5 | 10 | 15 | 20 | 30;
  restDays: number[];
  intensity: "gentle" | "balanced" | "active";
  energy: 1 | 2 | 3;
  monetary: boolean;
  weeklyCents: number;
  bonusCents: number;
  haptics: boolean;
  specialNeeds: string;
}
export interface State {
  profiles: Profile[];
  households: Household[];
  floors: Floor[];
  rooms: Room[];
  objects: Inventory[];
  tasks: Task[];
  completions: Completion[];
  dailyPlans: DailyPlan[];
  weeks: WeeklyPlan[];
  bonuses: Bonus[];
  megas: Mega[];
  problems: Problem[];
  rewards: Reward[];
  achievements: Achievement[];
  wishes: Wish[];
  settings: Settings[];
}
export const tables = [
  "profiles",
  "households",
  "floors",
  "rooms",
  "objects",
  "tasks",
  "completions",
  "dailyPlans",
  "weeks",
  "bonuses",
  "megas",
  "problems",
  "rewards",
  "achievements",
  "wishes",
  "settings",
] as const;
export function emptyState(): State {
  return Object.fromEntries(tables.map((t) => [t, []])) as unknown as State;
}
export function uid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  // Safari exposes getRandomValues over LAN HTTP, but randomUUID requires a
  // secure context. Keep UUID v4 identities and cryptographic randomness.
  if (typeof globalThis.crypto?.getRandomValues !== "function")
    throw new Error(
      "Tvoj prehliadač nedokáže vytvoriť identifikátor. Otvor aplikáciu v aktuálnom Safari alebo cez HTTPS.",
    );
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const xpFor = (minutes: number) =>
  minutes <= 3 ? 10 : minutes <= 5 ? 20 : minutes <= 10 ? 35 : 50;
export const money = (cents: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
