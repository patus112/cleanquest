import type {
  Day,
  ObjectCategory,
  Occurrence,
  RoomCategory,
  State,
} from "./model";
import { shiftDay, weekStart, weekday } from "./calendar";
import { completedIds, taskIsHeld } from "./scheduler";

const shortDays = ["PO", "UT", "ST", "ŠT", "PI", "SO", "NE"] as const;
const fullDays = [
  "pondelok",
  "utorok",
  "streda",
  "štvrtok",
  "piatok",
  "sobota",
  "nedeľa",
] as const;

export const rhythmPreviewLimit = 3;

export type RhythmIcon =
  | { kind: "object"; category: ObjectCategory }
  | { kind: "room"; category: RoomCategory };

export interface RhythmTask {
  id: string;
  title: string;
  done: boolean;
  icon: RhythmIcon;
}

export interface RhythmDay {
  date: Day;
  short: string;
  name: string;
  isToday: boolean;
  isPast: boolean;
  isRest: boolean;
  finished: boolean;
  tasks: RhythmTask[];
}

export function rhythmLabel(day: RhythmDay): string {
  const name = day.name.charAt(0).toUpperCase() + day.name.slice(1);
  if (!day.tasks.length) {
    if (day.isRest) return `${name}, voľno`;
    if (day.isToday) return `${name}, dnes`;
    return name;
  }
  const tasks = day.tasks
    .map((task) => (task.done ? `${task.title} (hotové)` : task.title))
    .join(", ");
  return `${day.isToday ? `${name}, dnes` : name}: ${tasks}`;
}

const effectiveDay = (occurrence: Occurrence) =>
  occurrence.deferredTo || occurrence.date;

/** Tasks already locked into this week's plans. One pass, no rescheduling. */
export function weekRhythm(s: State, today: Day): RhythmDay[] {
  const start = weekStart(today);
  const end = shiftDay(start, 6);
  const week = s.weeks.find((item) => item.start === start);
  const rest = new Set(week?.restDays ?? s.settings[0]?.restDays ?? []);
  const done = completedIds(s);
  const rooms = new Map(s.rooms.map((room) => [room.id, room]));
  const objects = new Map(s.objects.map((object) => [object.id, object]));
  const tasksById = new Map(s.tasks.map((task) => [task.id, task]));
  const byDay = new Map<Day, RhythmTask[]>();
  const placed = new Set<string>();

  const iconFor = (roomId: string, objectId?: string): RhythmIcon => {
    const object = objectId ? objects.get(objectId) : undefined;
    if (object) return { kind: "object", category: object.category };
    return { kind: "room", category: rooms.get(roomId)?.category || "other" };
  };
  const push = (date: Day, task: RhythmTask) => {
    if (date < start || date > end || placed.has(task.id)) return;
    placed.add(task.id);
    const list = byDay.get(date);
    if (list) list.push(task);
    else byDay.set(date, [task]);
  };

  for (const plan of s.dailyPlans)
    for (const occurrence of plan.occurrences) {
      if (occurrence.status === "skipped") continue;
      const date = effectiveDay(occurrence);
      const isDone = done.has(occurrence.id);
      if (date < today && !isDone) continue;
      if (
        !isDone &&
        !occurrence.lead &&
        taskIsHeld(s, today, occurrence.taskId)
      )
        continue;
      push(date, {
        id: occurrence.id,
        title: occurrence.title,
        done: isDone,
        icon: iconFor(occurrence.roomId, occurrence.objectId),
      });
    }

  for (const completion of s.completions) {
    if (
      completion.undone ||
      completion.type !== "required" ||
      completion.day < start ||
      completion.day > today ||
      placed.has(completion.occurrenceId)
    )
      continue;
    const task = tasksById.get(completion.taskId);
    push(completion.day, {
      id: completion.occurrenceId,
      title: completion.title,
      done: true,
      icon: iconFor(task?.roomId || "", task?.objectId),
    });
  }

  return shortDays.map((short, index) => {
    const date = shiftDay(start, index);
    const plan = s.dailyPlans.find((item) => item.date === date);
    return {
      date,
      short,
      name: fullDays[index],
      isToday: date === today,
      isPast: date < today,
      isRest: rest.has(weekday(date)),
      finished:
        !!plan?.occurrences.length &&
        plan.occurrences.every((occurrence) => done.has(occurrence.id)),
      tasks: byDay.get(date) || [],
    };
  });
}
