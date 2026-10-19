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
): Task[] {
  const settings = s.settings[0],
    objectById = new Map(s.objects.map((object) => [object.id, object])),
    roomById = new Map(s.rooms.map((room) => [room.id, room])),
    skipped = new Set(excluded);
  const due = tasks.filter((t) => {
    const object = t.objectId ? objectById.get(t.objectId) : undefined,
      room = roomById.get(t.roomId);
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
      (!t.eventAt || Date.parse(t.eventAt) <= Date.now())
    );
  });
  const baseScore = new Map<Task, number>();
  const score = (t: Task) => {
    const cached = baseScore.get(t);
    if (cached !== undefined) return cached;
    const value =
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
export function dailySession(
  s: State,
  day: Day,
  budget: number = s.settings[0].dailyBudget,
): Occurrence[] {
  const ready = currentTasks(s, day).sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
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
    if (o.duration <= left && !selectedTasks.has(o.taskId)) {
      selectedTasks.add(o.taskId);
      selected.push(o);
      left -= o.duration;
    }
  }
  return selected;
}
