import type { Day, State, Task } from "./model";
import { shiftDay } from "./calendar";
import { featurePresent } from "./rooms";

/**
 * How often a room may leave basics behind.
 * A household day counts when that room has at least one non-undone completion
 * of the previous tier. Today is included. Deleted tasks cannot be counted.
 *
 * Tier 1 is always available.
 * Tier 2 unlocks when a frequent Tier 1 task (every day or every other day)
 * was done on at least TIER_UNLOCK_DAYS distinct days inside the last
 * TIER_WINDOW_DAYS days, or when the room has no frequent Tier 1 task.
 * Tier 3 unlocks only when Tier 1 still meets that bar and a frequent Tier 2
 * task does too (or the room has no frequent Tier 2 task).
 * If the count falls back under the bar, higher tiers quietly stop being suggested.
 */
export const TIER_WINDOW_DAYS = 7;
export const TIER_UNLOCK_DAYS = 4;
/**
 * A task can land on 4 different days inside a 7-day window only when it
 * repeats at least every other day. Weekly and rarer resets still come first
 * on a day they are due. They do not have to be repeated four times.
 */
export const TIER_FREQUENT_INTERVAL_DAYS = 2;

export type CleaningTier = 1 | 2 | 3;

export const tierLabels: Record<CleaningTier, string> = {
  1: "Základ",
  2: "Čisté",
  3: "Detaily",
};

const TIER1_TITLES = new Set([
  "Uprať riad z drezu",
  "Naložiť riad do umývačky",
  "Vyložiť jednu časť riadu",
  "Utrieť jeden úsek pracovnej dosky",
  "Odložiť tri veci z pracovnej dosky",
  "Odložiť päť vecí z ostrovčeka",
  "Vytvoriť jedno voľné miesto na ostrovčeku",
  "Odložiť päť vecí zo stola",
  "Vrátiť päť vecí na miesto",
  "Odložiť veľké veci, ktoré sú na očiach",
  "Odložiť veci z podlahy",
  "Pozbierať veci z podlahy",
  "Vyniesť jeden malý kôš",
  "Vymeniť jedno vrecko v koši",
  "Roztriediť jeden kôš bielizne",
  "Pripraviť jednu dávku prania",
  "Spustiť jednu dávku prania",
  "Vyvesiť jednu malú dávku",
  "Presunúť jednu dávku do sušičky",
  "Spustiť jednu dávku sušenia",
  "Poskladať jednu malú dávku bielizne",
  "Preložiť pranie",
  "Očistiť WC misu kefou",
  "Rýchlo očistiť WC misu",
  "Ustlať jednu posteľ",
  "Odložiť päť hračiek",
  "Odložiť tri veci zo schodov",
  "Upraviť dva vankúše",
  "Zložiť jednu deku",
  "Vybrať viditeľné drobnosti z koberca",
  "Zavesiť päť kusov oblečenia",
  "Odložiť jednu dávku čistej bielizne",
]);

const TIER3_TITLES = new Set([
  "Vybrať viditeľné nečistoty zo sitka",
  "Očistiť zátku umývadla",
  "Utrieť dávkovač mydla",
  "Očistiť jednu páčku batérie",
  "Utrieť podstavec batérie",
  "Očistiť viditeľnú časť výtoku",
  "Utrieť viditeľnú stranu jednej batérie",
  "Očistiť sitko bez rozoberania odtoku",
  "Vytriediť jednu zásuvku",
  "Roztriediť päť drobností",
  "Vybrať nepotrebné obaly zo zásuvky",
  "Zoskupiť obsah jednej priehradky",
  "Vytriediť jednu časť skrinky",
  "Utrieť jednu vnútornú policu",
  "Zoradiť knihy na jednej polici",
  "Vybrať tri nepotrebné veci",
  "Uvoľniť jeden malý úložný priestor",
  "Oprášiť päť dekorácií",
  "Vytriediť jednu kôpku papierov",
  "Utrieť miesto pod podložkou",
  "Skontrolovať filter podľa návodu",
  "Zapísať termín údržby filtra",
  "Očistiť jednu policu chladničky",
  "Skontrolovať jednu priehradku potravín",
  "Utrieť jednu priehradku vo dverách",
  "Očistiť jednu zásuvku na zeleninu",
  "Skontrolovať viditeľné tesnenie dverí",
  "Utrieť dostupné tesnenie",
  "Doplniť prostriedok podľa návodu",
  "Vyčistiť filter sušičky podľa návodu",
  "Očistiť zásuvku na prací prostriedok",
  "Skontrolovať dostupné tesnenie práčky",
  "Skontrolovať údržbu podľa výrobcu",
  "Skontrolovať odporúčanú údržbu rúry",
  "Usporiadať tri voľné káble bez odpájania",
  "Oprášiť mriežku podľa návodu",
  "Oprášiť obrazovku podľa návodu",
  "Utrieť reproduktor zhora",
  "Oprášiť bočnú stranu reproduktora",
  "Oprášiť stojan reproduktora",
  "Utrieť plochu okolo reproduktora",
  "Utrieť dostupný podstavec reproduktora",
  "Očistiť jednu časť vodiacej drážky",
  "Vytriediť veci z jednej strany postele",
  "Vybrať tri kusy na darovanie",
  "Upratať jednu policu v skrini",
  "Vytriediť jeden box hračiek",
  "Zoradiť jednu sadu hier",
  "Usporiadať jednu policu s hračkami",
  "Vybrať poškodené veci z jedného boxu",
  "Vytriediť päť kusov odpadu",
  "Očistiť jeden úsek sokla",
  "Vyleštiť jednu časť zrkadla",
  "Utrieť kryt jedného vypínača",
  "Oprášiť jeden dostupný kryt",
  "Odstrániť odtlačky z jedného krytu",
  "Utrieť rám jedného vypínača",
  "Oprášiť jednu prístupnú hranu",
  "Skontrolovať čistotu jedného krytu",
  "Vytriediť jednu priehradku na topánky",
  "Upratať tri páry topánok",
]);

export function isCleaningTier(value: unknown): value is CleaningTier {
  return value === 1 || value === 2 || value === 3;
}

/** Stored tier wins. Otherwise the title and template id decide. Unknown work is regular cleaning. */
export function taskTier(task: {
  tier?: number;
  title: string;
  templateId?: string;
}): CleaningTier {
  if (isCleaningTier(task.tier)) return task.tier;
  const id = task.templateId ?? "";
  if (id.startsWith("basic-") || TIER1_TITLES.has(task.title)) return 1;
  if (
    id.startsWith("season-") ||
    id.startsWith("curtain-") ||
    id.startsWith("blind-") ||
    id === "washer-maintenance" ||
    TIER3_TITLES.has(task.title)
  )
    return 3;
  return 2;
}

export function daysPhrase(count: number): string {
  if (count === 1) return "1 deň";
  if (count >= 2 && count <= 4) return `${count} dni`;
  return `${count} dní`;
}

/** Kind progress line. No locks and no comment when a week was hard. */
export function tierHint(days: number, hasBasics: boolean): string {
  if (!hasBasics) return "";
  if (days >= TIER_UNLOCK_DAYS)
    return `Základ ti ide už ${daysPhrase(days)}, pomaly pridáme ďalšie.`;
  if (days > 0)
    return `Základ ti ide už ${daysPhrase(days)} z posledných ${TIER_WINDOW_DAYS}. Pokojne pokračuj.`;
  return "Dnes stačí, aby to na prvý pohľad vyzeralo upratané.";
}

export const rescueHint =
  "Ťažký deň. Dnes len základ, ostatné v pokoji počká.";

export interface RoomTierState {
  tier1Days: number;
  tier2Days: number;
  hasTier1: boolean;
  hasTier2: boolean;
  /** Tier-1 work that can actually occur on 4 days of a week. */
  hasFrequentTier1: boolean;
  /** Tier-2 work that can actually occur on 4 days of a week. */
  hasFrequentTier2: boolean;
  basicsOpen: boolean;
  openedToday: boolean;
}

export interface TierContext {
  rooms: Map<string, RoomTierState>;
}

function tierReady(room: RoomTierState, tier: 1 | 2): boolean {
  if (tier === 1)
    return !room.hasFrequentTier1 || room.tier1Days >= TIER_UNLOCK_DAYS;
  return !room.hasFrequentTier2 || room.tier2Days >= TIER_UNLOCK_DAYS;
}

export function frequentTierTask(
  task: {
    tier?: number;
    title: string;
    templateId?: string;
    enabled?: boolean;
    recurrence?: { unit: string; interval: number };
  },
  tier: 1 | 2,
): boolean {
  return (
    task.enabled !== false &&
    taskTier(task) === tier &&
    task.recurrence?.unit === "day" &&
    (task.recurrence.interval ?? 1) <= TIER_FREQUENT_INTERVAL_DAYS
  );
}

export function canSuggest(
  room: RoomTierState,
  tier: CleaningTier,
  rescue: boolean,
): boolean {
  if (rescue && tier > 1) return false;
  if (tier <= 1) return true;
  if (room.basicsOpen) return false;
  if (!tierReady(room, 1)) return false;
  if (tier === 3 && !tierReady(room, 2)) return false;
  return true;
}

export function floorRank(s: State, roomId: string): number {
  const room = s.rooms.find((item) => item.id === roomId);
  if (!room) return 100;
  const order = s.floors.find((item) => item.id === room.floorId)?.order;
  return order ?? 100;
}

function actionable(s: State, task: Task, day: Day, nowMs: number): boolean {
  const settings = s.settings[0];
  const budget = settings?.dailyBudget ?? 30;
  const energy = settings?.energy ?? 3;
  const object = task.objectId
    ? s.objects.find((item) => item.id === task.objectId)
    : undefined;
  const room = s.rooms.find((item) => item.id === task.roomId);
  return (
    task.enabled &&
    (!task.objectId || object?.accessibility === "safe") &&
    task.nextDue <= day &&
    task.duration <= budget &&
    task.energy <= energy &&
    !!room &&
    room.enabled &&
    featurePresent(room, object?.category || "") &&
    (!task.eventAt || Date.parse(task.eventAt) <= nowMs)
  );
}

export function buildTierContext(
  s: State,
  day: Day,
  tasks: Task[] = s.tasks,
  nowMs = Date.now(),
): TierContext {
  const start = shiftDay(day, -(TIER_WINDOW_DAYS - 1));
  const byId = new Map(s.tasks.map((task) => [task.id, task]));
  const days = new Map<string, { tier1: Set<string>; tier2: Set<string> }>();
  const key = (roomId: string) => {
    let row = days.get(roomId);
    if (!row) {
      row = { tier1: new Set(), tier2: new Set() };
      days.set(roomId, row);
    }
    return row;
  };
  for (const completion of s.completions) {
    if (
      completion.undone ||
      completion.day < start ||
      completion.day > day
    )
      continue;
    const task = byId.get(completion.taskId);
    if (!task) continue;
    const tier = taskTier(task);
    if (tier === 1) key(task.roomId).tier1.add(completion.day);
    if (tier === 2) key(task.roomId).tier2.add(completion.day);
  }
  const completedToday = new Set(
    s.completions
      .filter((completion) => !completion.undone && completion.day === day)
      .map((completion) => completion.taskId),
  );
  const basicsOk = new Set(
    s.dailyPlans.find((plan) => plan.date === day)?.basicsOk ?? [],
  );
  const rooms = new Map<string, RoomTierState>();
  const roomIds = new Set<string>([
    ...s.rooms.map((room) => room.id),
    ...tasks.map((task) => task.roomId),
  ]);
  for (const roomId of roomIds) {
    const inRoom = tasks.filter((task) => task.roomId === roomId);
    const hasTier1 = inRoom.some(
      (task) => task.enabled && taskTier(task) === 1,
    );
    const hasTier2 = inRoom.some(
      (task) => task.enabled && taskTier(task) === 2,
    );
    const hasFrequentTier1 = inRoom.some((task) => frequentTierTask(task, 1));
    const hasFrequentTier2 = inRoom.some((task) => frequentTierTask(task, 2));
    const openBasic = inRoom.some(
      (task) =>
        taskTier(task) === 1 &&
        !completedToday.has(task.id) &&
        actionable(s, task, day, nowMs),
    );
    const didBasic = inRoom.some(
      (task) => taskTier(task) === 1 && completedToday.has(task.id),
    );
    rooms.set(roomId, {
      tier1Days: days.get(roomId)?.tier1.size ?? 0,
      tier2Days: days.get(roomId)?.tier2.size ?? 0,
      hasTier1,
      hasTier2,
      hasFrequentTier1,
      hasFrequentTier2,
      basicsOpen: hasTier1 && openBasic && !basicsOk.has(roomId),
      openedToday: didBasic || basicsOk.has(roomId),
    });
  }
  return { rooms };
}
