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
 * TIER_WINDOW_DAYS days. A room whose basics are only weekly or rarer does
 * not skip ahead: Tier 2 unlocks when each of those basics is done for the
 * day it is due. Tier 3 needs that Tier 1 bar and the same kind of Tier 2
 * bar. Having no frequent task is not itself a reason to show Detaily.
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

export const CLEANING_LEVELS = ["Základ", "Čisté", "Detaily"] as const;

export type CleaningLevelState = "done" | "current" | "later";

/** Where today is on the ladder. Ťažký deň stays on Základ. */
export function cleaningProgress(
  rescue: boolean,
  suggestedTier: 1 | 2 | 3 | null,
): { name: (typeof CLEANING_LEVELS)[number]; state: CleaningLevelState }[] {
  const active = rescue || suggestedTier == null ? 1 : suggestedTier;
  return CLEANING_LEVELS.map((name, index) => {
    const level = index + 1;
    return {
      name,
      state: level < active ? "done" : level === active ? "current" : "later",
    };
  });
}

export interface RoomTierState {
  tier1Days: number;
  tier2Days: number;
  hasTier1: boolean;
  hasTier2: boolean;
  /** Tier-1 work that can actually occur on 4 days of a week. */
  hasFrequentTier1: boolean;
  /** Tier-2 work that can actually occur on 4 days of a week. */
  hasFrequentTier2: boolean;
  /** Frequent bar met, or every rarer task of this tier is done when due. */
  tier1Ready: boolean;
  /** Same rule one step up. No task of this tier counts as ready. */
  tier2Ready: boolean;
  basicsOpen: boolean;
  openedToday: boolean;
  /** A due tier-1 task is still unfinished. Independent of Základ máme. */
  pendingBasic: boolean;
  /** A tier-1 task was completed today. */
  didBasic: boolean;
  /** Základ máme for today. Remaining basics in this room step aside. */
  markedOk: boolean;
  /** Floor id when this room shares the open-plan gate. */
  openPlanFloorId?: string;
}

export interface ZoneTierState {
  floorId: string;
  roomIds: string[];
  tier1Days: number;
  tier2Days: number;
  hasFrequentTier1: boolean;
  hasFrequentTier2: boolean;
  tier1Ready: boolean;
  tier2Ready: boolean;
  /** Ready for suggestions. Základ máme covers a rarer basic for today only. */
  tier1Suggest: boolean;
  basicsOpen: boolean;
  openedToday: boolean;
  markedOk: boolean;
}

export interface TierContext {
  rooms: Map<string, RoomTierState>;
  zones: Map<string, ZoneTierState>;
}

function tierReady(room: RoomTierState, tier: 1 | 2): boolean {
  return tier === 1 ? room.tier1Ready : room.tier2Ready;
}

/** The 4-day bar is never skipped. Základ máme only covers weekly or rarer basics. */
function suggestsTier1(room: RoomTierState): boolean {
  if (!room.hasTier1 || room.tier1Ready) return true;
  return !room.hasFrequentTier1 && room.markedOk;
}

/**
 * Frequent work uses the 4-day bar. Weekly and rarer work is ready when
 * nothing of that tier is still due today. No task of the tier does not
 * block the next one.
 */
function roomTierReady(
  tasks: Task[],
  tier: 1 | 2,
  days: number,
  day: Day,
  doneToday: Set<string>,
): boolean {
  const mine = tasks.filter((task) => task.enabled && taskTier(task) === tier);
  if (!mine.length) return true;
  if (mine.some((task) => frequentTierTask(task, tier)))
    return days >= TIER_UNLOCK_DAYS;
  return mine.every((task) => task.nextDue > day || doneToday.has(task.id));
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

export function zoneOf(
  ctx: TierContext,
  roomId: string,
): ZoneTierState | undefined {
  const floorId = ctx.rooms.get(roomId)?.openPlanFloorId;
  return floorId ? ctx.zones.get(floorId) : undefined;
}

export function canSuggest(
  room: RoomTierState,
  tier: CleaningTier,
  rescue: boolean,
  zone?: ZoneTierState,
): boolean {
  if (rescue && tier > 1) return false;
  const markedOk = zone ? zone.markedOk : room.markedOk;
  if (tier <= 1) return !markedOk;
  const basicsOpen = zone ? zone.basicsOpen : room.basicsOpen;
  const ready1 = zone ? zone.tier1Suggest : suggestsTier1(room);
  const ready2 = zone ? zone.tier2Ready : tierReady(room, 2);
  if (basicsOpen) return false;
  if (!ready1) return false;
  if (tier === 3 && !ready2) return false;
  return true;
}

/** Whether today's sync may add a higher tier. A zone waits for every room. */
export function openedForSuggestions(ctx: TierContext, roomId: string): boolean {
  const zone = zoneOf(ctx, roomId);
  if (zone) return zone.openedToday;
  return !!ctx.rooms.get(roomId)?.openedToday;
}

/** Days of základ the hint should show. A zone uses the quietest member. */
export function streakFor(s: State, day: Day, roomId: string) {
  const ctx = buildTierContext(s, day);
  const zone = zoneOf(ctx, roomId);
  if (zone)
    return {
      days: zone.tier1Days,
      hasBasics: zone.roomIds.some((id) => ctx.rooms.get(id)?.hasTier1),
    };
  const room = ctx.rooms.get(roomId);
  return { days: room?.tier1Days ?? 0, hasBasics: !!room?.hasTier1 };
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
    const tier1Days = days.get(roomId)?.tier1.size ?? 0;
    const tier2Days = days.get(roomId)?.tier2.size ?? 0;
    const tier1Ready = roomTierReady(
      inRoom,
      1,
      tier1Days,
      day,
      completedToday,
    );
    const tier2Ready = roomTierReady(
      inRoom,
      2,
      tier2Days,
      day,
      completedToday,
    );
    const openBasic = inRoom.some(
      (task) =>
        taskTier(task) === 1 &&
        !completedToday.has(task.id) &&
        actionable(s, task, day, nowMs),
    );
    const didBasic = inRoom.some(
      (task) => taskTier(task) === 1 && completedToday.has(task.id),
    );
    const markedOk = basicsOk.has(roomId);
    const pendingBasic = hasTier1 && openBasic;
    rooms.set(roomId, {
      tier1Days,
      tier2Days,
      hasTier1,
      hasTier2,
      hasFrequentTier1,
      hasFrequentTier2,
      tier1Ready,
      tier2Ready,
      basicsOpen: pendingBasic && !markedOk,
      openedToday: didBasic || markedOk,
      pendingBasic,
      didBasic,
      markedOk,
    });
  }
  const zones = new Map<string, ZoneTierState>();
  const members = new Map<string, string[]>();
  for (const room of s.rooms) {
    if (!room.openPlan || !room.enabled) continue;
    const list = members.get(room.floorId) ?? [];
    list.push(room.id);
    members.set(room.floorId, list);
  }
  for (const [floorId, ids] of members) {
    for (const id of ids) {
      const row = rooms.get(id);
      if (row) row.openPlanFloorId = floorId;
    }
    const states = ids.map((id) => rooms.get(id)).filter((row) => !!row);
    const frequent1 = states.filter((row) => row.hasFrequentTier1);
    const frequent2 = states.filter((row) => row.hasFrequentTier2);
    const markedOk = states.some((row) => row.markedOk);
    const basicsOpen = !markedOk && states.some((row) => row.pendingBasic);
    zones.set(floorId, {
      floorId,
      roomIds: ids,
      tier1Days: frequent1.length
        ? Math.min(...frequent1.map((row) => row.tier1Days))
        : 0,
      tier2Days: frequent2.length
        ? Math.min(...frequent2.map((row) => row.tier2Days))
        : 0,
      hasFrequentTier1: frequent1.length > 0,
      hasFrequentTier2: frequent2.length > 0,
      tier1Ready: states.every((row) => row.tier1Ready),
      tier2Ready: states.every((row) => row.tier2Ready),
      tier1Suggest: states.every((row) => suggestsTier1(row)),
      basicsOpen,
      openedToday:
        !basicsOpen && (markedOk || states.some((row) => row.didBasic)),
      markedOk,
    });
  }
  return { rooms, zones };
}

export type BasicToday = "done" | "waiting" | "later";

export interface LevelRoomView {
  roomId: string;
  name: string;
  tier1Days: number;
  basics: { id: string; title: string; status: BasicToday }[];
}

export interface LevelGroupView {
  id: string;
  kind: "zone" | "room";
  name: string;
  level: CleaningTier;
  tier1Days: number;
  note: string;
  rooms: LevelRoomView[];
}

function reachedLevel(
  hasTier1: boolean,
  tier1Ready: boolean,
  tier2Ready: boolean,
  hasTier2: boolean,
  hasTier3: boolean,
): CleaningTier {
  if (!hasTier1 || !tier1Ready) return 1;
  if (tier2Ready && hasTier3) return 3;
  if (hasTier2 || hasTier3) return 2;
  return 1;
}

const rareReadyNote =
  "Základ sa tu opakuje zriedkavejšie než každý druhý deň. Máš ho hotový, keď príde na rad, takže sa môže ukázať ďalšia úroveň.";
const rareDetailsNote =
  "Základ aj čistenie sa tu opakujú zriedkavejšie. Sú hotové, keď prídu na rad, preto sa ukazuje Detaily.";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} a ${names[names.length - 1]}`;
}

/** What she can see: the level, the 7-day základ, and today's basics. */
export function levelOverview(s: State, day: Day): LevelGroupView[] {
  const ctx = buildTierContext(s, day);
  const completedToday = new Set(
    s.completions
      .filter((completion) => !completion.undone && completion.day === day)
      .map((completion) => completion.taskId),
  );
  const roomView = (roomId: string): LevelRoomView => {
    const room = s.rooms.find((item) => item.id === roomId);
    const rank: Record<BasicToday, number> = {
      waiting: 0,
      later: 1,
      done: 2,
    };
    const basics = s.tasks
      .filter(
        (task) =>
          task.roomId === roomId && task.enabled && taskTier(task) === 1,
      )
      .map((task, index) => ({
        id: task.id,
        title: task.title,
        index,
        status: (completedToday.has(task.id)
          ? "done"
          : task.nextDue <= day
            ? "waiting"
            : "later") as BasicToday,
      }))
      .sort((a, b) => rank[a.status] - rank[b.status] || a.index - b.index)
      .map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
      }));
    return {
      roomId,
      name: room?.name || "Miestnosť",
      tier1Days: ctx.rooms.get(roomId)?.tier1Days ?? 0,
      basics,
    };
  };
  const groups: LevelGroupView[] = [];
  const seen = new Set<string>();
  for (const floor of [...s.floors].sort((a, b) => a.order - b.order)) {
    const zone = ctx.zones.get(floor.id);
    if (!zone) continue;
    for (const id of zone.roomIds) seen.add(id);
    const members = zone.roomIds.map(roomView);
    const frequentBehind = members.filter((room) => {
      const state = ctx.rooms.get(room.roomId);
      return !!state?.hasFrequentTier1 && room.tier1Days < TIER_UNLOCK_DAYS;
    });
    const rareBehind = members.filter((room) => {
      const state = ctx.rooms.get(room.roomId);
      return !!state?.hasTier1 && !state.hasFrequentTier1 && !state.tier1Ready;
    });
    const hasTier1 = zone.roomIds.some((id) => ctx.rooms.get(id)?.hasTier1);
    const hasTier2 = zone.roomIds.some((id) => ctx.rooms.get(id)?.hasTier2);
    const hasTier3 = zone.roomIds.some((id) =>
      s.tasks.some(
        (task) =>
          task.roomId === id && task.enabled && taskTier(task) === 3,
      ),
    );
    const level = reachedLevel(
      hasTier1,
      zone.tier1Ready,
      zone.tier2Ready,
      hasTier2,
      hasTier3,
    );
    const frequentNames = joinNames(frequentBehind.map((room) => room.name));
    const rareNames = joinNames(rareBehind.map((room) => room.name));
    const note = frequentBehind.length
      ? `${frequentNames} ${frequentBehind.length === 1 ? "má" : "majú"} základ menej ako 4 dni z posledných 7. Čisté príde, až keď ho bude mať celý priestor.`
      : rareBehind.length
        ? `${rareNames} ${rareBehind.length === 1 ? "ešte čaká" : "ešte čakajú"} so základom, ktorý príde zriedkavejšie. Čisté príde, až keď ho bude mať celý priestor.`
        : !zone.hasFrequentTier1 && level > 1
          ? level === 3
            ? rareDetailsNote
            : rareReadyNote
          : zone.basicsOpen
            ? "Dnes ešte základ. Potom sa môže ukázať ďalšia úroveň."
            : level === 1
              ? "Dnes stačí, aby to na prvý pohľad vyzeralo upratané."
              : "Celý priestor má základ. Ďalšia úroveň sa môže ukázať.";
    groups.push({
      id: `zone:${floor.id}`,
      kind: "zone",
      name: `${floor.name} – otvorený priestor`,
      level,
      tier1Days: zone.tier1Days,
      note,
      rooms: members,
    });
  }
  for (const room of [...s.rooms].sort((a, b) => a.order - b.order)) {
    if (!room.enabled || seen.has(room.id)) continue;
    const state = ctx.rooms.get(room.id);
    const view = roomView(room.id);
    const hasTier3 = s.tasks.some(
      (task) =>
        task.roomId === room.id && task.enabled && taskTier(task) === 3,
    );
    const level = reachedLevel(
      !!state?.hasTier1,
      !!state?.tier1Ready,
      !!state?.tier2Ready,
      !!state?.hasTier2,
      hasTier3,
    );
    const note = !state?.hasTier1
      ? "Základ tu zatiaľ nemáš. Ďalšie úlohy môžu pokojne počkať."
      : level > 1 && !state.hasFrequentTier1
        ? level === 3
          ? rareDetailsNote
          : rareReadyNote
        : tierHint(state.tier1Days, true);
    groups.push({
      id: room.id,
      kind: "room",
      name: room.name,
      level,
      tier1Days: state?.tier1Days ?? 0,
      note,
      rooms: [view],
    });
  }
  return groups;
}
