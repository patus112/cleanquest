import type { State, Task, Occurrence, Day } from "./model";
import { xpFor } from "./model";
import { featurePresent } from "./rooms";
import {
  nextOccurrence,
  shiftDay,
  weekStart,
  weekday,
  distance,
} from "./calendar";
import {
  buildTierContext,
  canSuggest,
  openedForSuggestions,
  zoneOf,
  floorRank,
  taskTier,
  type TierContext,
} from "./tiers";
export function snapshot(s: State, t: Task, day: Day): Occurrence {
  return {
    id: `${t.id}@${day}`,
    taskId: t.id,
    roomId: t.roomId,
    roomName: s.rooms.find((r) => r.id === t.roomId)?.name || "Miestnosť",
    objectId: t.objectId,
    objectName: s.objects.find((o) => o.id === t.objectId)?.name,
    title: t.title,
    instructions: t.instructions,
    duration: t.duration,
    xp: xpFor(t.duration),
    date: day,
    status: "pending",
  };
}
export function pickTasks(
  s: State,
  day: Day,
  tasks: Task[],
  budget: number,
  excluded: string[] = [],
  previousRoom = "",
  options?: { rescue?: boolean },
): Task[] {
  const settings = s.settings[0],
    objectById = new Map(s.objects.map((object) => [object.id, object])),
    roomById = new Map(s.rooms.map((room) => [room.id, room])),
    skipped = new Set(excluded),
    tiers = buildTierContext(s, day, tasks),
    rescue = !!options?.rescue;
  const due = tasks.filter((t) => {
    const object = t.objectId ? objectById.get(t.objectId) : undefined,
      room = roomById.get(t.roomId),
      gate = tiers.rooms.get(t.roomId);
    return (
      t.enabled &&
      (!t.objectId || object?.accessibility === "safe") &&
      t.nextDue <= day &&
      t.duration <= budget &&
      t.energy <= settings.energy &&
      !skipped.has(t.id) &&
      !!room &&
      room.enabled &&
      featurePresent(room, object?.category || "") &&
      (!t.eventAt || Date.parse(t.eventAt) <= Date.now()) &&
      !!gate &&
      canSuggest(gate, taskTier(t), rescue, zoneOf(tiers, t.roomId))
    );
  });
  const baseScore = new Map<Task, number>();
  const score = (t: Task) => {
    const cached = baseScore.get(t);
    if (cached !== undefined) return cached;
    const tier = taskTier(t);
    const floor = Math.max(0, 12 - Math.min(12, floorRank(s, t.roomId))) * 5;
    // Tier dominates. Priority beats floor. Floor only breaks a tie.
    const value =
      (4 - tier) * 2000 +
      floor +
      Math.max(0, 10 - Math.min(10, t.duration)) +
      t.priority * 20 +
      Math.min(14, Math.max(0, distance(day, t.nextDue))) * 2 +
      (t.roomId !== previousRoom ? 9 : 0) +
      (t.energy === 1 ? 2 : 0);
    baseScore.set(t, value);
    return value;
  };
  const ranked = due.map((task, index) => ({
    task,
    index,
    base: score(task),
  }));
  // One id ordering, then numeric comparisons. String compare matches
  // localeCompare for the UUID and ASCII ids this app stores.
  ranked.sort((a, b) =>
    a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : a.index - b.index,
  );
  ranked.forEach((item, order) => (item.index = order));
  const selected: Task[] = [];
  let remaining = budget;
  const rooms = new Set<string>();
  while (ranked.length && selected.length < 8) {
    let best = 0;
    for (let index = 1; index < ranked.length; index++) {
      const left = ranked[index],
        right = ranked[best],
        delta =
          left.base -
          (rooms.has(left.task.roomId) ? 12 : 0) -
          (right.base - (rooms.has(right.task.roomId) ? 12 : 0));
      if (delta > 0 || (delta === 0 && left.index < right.index)) best = index;
    }
    const [{ task: t }] = ranked.splice(best, 1);
    if (t.duration > remaining) continue;
    selected.push(t);
    remaining -= t.duration;
    rooms.add(t.roomId);
  }
  return selected;
}
export function ensurePlans(
  s: State,
  day: Day,
  now = new Date().toISOString(),
  options?: { sync?: boolean },
): void {
  const h = s.households[0];
  if (!h) return;
  const start = weekStart(day),
    settings = s.settings[0];
  if (!s.weeks.some((w) => w.start === start)) {
    const simulation = structuredClone(s.tasks);
    const required: Occurrence[] = [];
    let previousRoom = "";
    for (let i = 0; i < 7; i++) {
      const date = shiftDay(start, i);
      if (date < day || settings.restDays.includes(weekday(date))) continue;
      const chosen = pickTasks(
        s,
        date,
        simulation,
        settings.dailyBudget,
        [],
        previousRoom,
      );
      const occurrences = chosen.map((t) => snapshot(s, t, date));
      required.push(...occurrences);
      s.dailyPlans.push({
        id: `day:${h.id}:${date}`,
        householdId: h.id,
        date,
        occurrences,
        timeBudget: settings.dailyBudget,
        lockedAt: now,
      });
      for (const t of chosen) {
        t.nextDue = nextOccurrence(t.recurrence, date);
        previousRoom = t.roomId;
      }
    }
    s.weeks.push({
      id: `week:${h.id}:${start}`,
      householdId: h.id,
      start,
      end: shiftDay(start, 6),
      required: structuredClone(required),
      rewardCents: settings.weeklyCents,
      rewardEnabled: settings.monetary,
      restDays: [...settings.restDays],
      lockedAt: now,
    });
  }
  if (!s.dailyPlans.some((p) => p.date === day))
    s.dailyPlans.push({
      id: `day:${h.id}:${day}`,
      householdId: h.id,
      date: day,
      occurrences: [],
      timeBudget: settings.dailyBudget,
      lockedAt: now,
    });
  // settings.dailyBudget is the only minutes setting. Today and later days
  // follow it; a past day keeps the snapshot it was lived with.
  if (settings)
    for (const plan of s.dailyPlans) {
      if (plan.date >= day) plan.timeBudget = settings.dailyBudget;
    }
  if (!s.bonuses.some((b) => b.week === start))
    s.bonuses.push({
      id: `bonus:${h.id}:${start}`,
      householdId: h.id,
      week: start,
      title: "Jedna polica, viac priestoru",
      steps: [
        "Vybrať veci z jednej police",
        "Utrieť prázdnu policu",
        "Odložiť veci, ktoré sem patria",
      ].map((title, i) => ({
        id: `step-${i}`,
        title,
        duration: 5,
        done: false,
      })),
      rewardCents: settings.bonusCents,
      monetaryEnabled: settings.monetary,
      awarded: false,
      variant: 0,
    });
  if (options?.sync !== false) syncTierSuggestions(s, day);
}
/** Add missing basics, and details only after today's basics were actually handled. */
export function syncTierSuggestions(s: State, day: Day): void {
  const settings = s.settings[0];
  const plan = s.dailyPlans.find((item) => item.date === day);
  if (!settings || !plan || settings.restDays.includes(weekday(day))) return;
  const rescue = !!settings.rescue;
  const ctx = buildTierContext(s, day, s.tasks);
  const visible = plan.occurrences.filter(
    (occurrence) =>
      occurrence.status === "pending" &&
      (!occurrence.deferredTo || occurrence.deferredTo <= day) &&
      !completedIds(s).has(occurrence.id) &&
      !holds(s, day, occurrence, ctx, rescue),
  );
  const spent = s.completions
    .filter(
      (completion) =>
        !completion.undone && completion.day === day && completion.type !== "extra",
    )
    .reduce((total, completion) => total + completion.duration, 0);
  // Time already used today stays reserved, so a newly suggested basic cannot
  // push an agreed task out of the remaining block.
  let free =
    plan.timeBudget -
    spent -
    visible.reduce((total, occurrence) => total + occurrence.duration, 0);
  if (free <= 0) return;
  const start = weekStart(day);
  const scheduled = new Set(
    s.dailyPlans
      .filter((item) => item.date >= start && item.date <= shiftDay(start, 6))
      .flatMap((item) => item.occurrences.map((occurrence) => occurrence.taskId)),
  );
  const picks = pickTasks(
    s,
    day,
    s.tasks,
    free,
    [...scheduled],
    "",
    { rescue },
  );
  for (const task of picks) {
    if (scheduled.has(task.id) || task.duration > free) continue;
    const tier = taskTier(task);
    if (tier > 1 && (rescue || !openedForSuggestions(ctx, task.roomId)))
      continue;
    const occurrence = snapshot(s, task, day);
    if (tier === 1) plan.occurrences.unshift(occurrence);
    else plan.occurrences.push(occurrence);
    scheduled.add(task.id);
    free -= task.duration;
  }
}
function holds(
  s: State,
  day: Day,
  occurrence: Occurrence,
  ctx: TierContext,
  rescue: boolean,
): boolean {
  if (occurrence.lead) return false;
  const task = s.tasks.find((item) => item.id === occurrence.taskId);
  if (!task) return false;
  const room = ctx.rooms.get(task.roomId);
  if (!room) return false;
  return !canSuggest(room, taskTier(task), rescue, zoneOf(ctx, task.roomId));
}
export function taskIsHeld(s: State, day: Day, taskId: string): boolean {
  const task = s.tasks.find((item) => item.id === taskId);
  if (!task) return false;
  const ctx = buildTierContext(s, day, s.tasks);
  const room = ctx.rooms.get(task.roomId);
  if (!room) return false;
  return !canSuggest(
    room,
    taskTier(task),
    !!s.settings[0]?.rescue,
    zoneOf(ctx, task.roomId),
  );
}
export const completedIds = (s: State) =>
  new Set(
    s.completions
      .filter((c) => !c.undone && c.type === "required")
      .map((c) => c.occurrenceId),
  );
export function currentTasks(s: State, day: Day): Occurrence[] {
  const ids = completedIds(s);
  const completedToday = new Set(
    s.completions
      .filter((c) => !c.undone && c.day === day)
      .map((c) => c.taskId),
  );
  return s.dailyPlans
    .flatMap((p) => p.occurrences)
    .filter(
      (o) =>
        o.date <= day &&
        o.date >= weekStart(day) &&
        !completedToday.has(o.taskId) &&
        !ids.has(o.id) &&
        o.status === "pending" &&
        (!o.deferredTo || o.deferredTo <= day),
    );
}
function compareOccurrence(s: State, a: Occurrence, b: Occurrence): number {
  if (!!a.lead !== !!b.lead) return a.lead ? -1 : 1;
  const taskA = s.tasks.find((task) => task.id === a.taskId);
  const taskB = s.tasks.find((task) => task.id === b.taskId);
  const tierA = taskA ? taskTier(taskA) : 2;
  const tierB = taskB ? taskTier(taskB) : 2;
  if (tierA !== tierB) return tierA - tierB;
  const floor = floorRank(s, a.roomId) - floorRank(s, b.roomId);
  if (floor) return floor;
  const priority = (taskB?.priority ?? 0) - (taskA?.priority ?? 0);
  if (priority) return priority;
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}
/** Pending plan tasks that may be suggested today. Held details stay in the snapshot. */
export function openTasks(s: State, day: Day): Occurrence[] {
  const rescue = !!s.settings[0]?.rescue;
  const ctx = buildTierContext(s, day, s.tasks);
  return currentTasks(s, day)
    .filter((occurrence) => !holds(s, day, occurrence, ctx, rescue))
    .sort((a, b) => compareOccurrence(s, a, b));
}
export function dailySession(
  s: State,
  day: Day,
  budget: number = s.settings[0].dailyBudget,
): Occurrence[] {
  const ready = openTasks(s, day);
  const selected: Occurrence[] = [];
  const selectedTasks = new Set<string>();
  let left = Math.max(
    0,
    budget -
      s.completions
        .filter((c) => !c.undone && c.day === day && c.type !== "extra")
        .reduce((n, c) => n + c.duration, 0),
  );
  for (const o of ready) {
    const firstLead = !!o.lead && selected.length === 0;
    if ((firstLead || o.duration <= left) && !selectedTasks.has(o.taskId)) {
      selectedTasks.add(o.taskId);
      selected.push(o);
      left -= o.duration;
    }
  }
  return selected;
}
