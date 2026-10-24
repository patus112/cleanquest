import type { State, Task } from "./model";
import { dayOf } from "./commands";
import { backupReminderDue, type LocalSafety } from "./localSafety";
import { todayPace } from "./progress";

export interface DailyReminderItems {
  day: string;
  /** One gentle line about today, or nothing. Never a count of the week backlog. */
  line: string | null;
  laundry: number;
  backup: boolean;
}

const countForm = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "many";
  const mod10 = n % 10;
  if (mod10 === 1) return "one";
  if (mod10 >= 2 && mod10 <= 4) return "few";
  return "many";
};

export function laundryLine(count: number) {
  const form = countForm(count);
  if (form === "one") return "Pranie má pripravený ďalší krok.";
  if (form === "few") return `Pranie má pripravené ${count} ďalšie kroky.`;
  return `Pranie má pripravených ${count} ďalších krokov.`;
}

export function pendingLaundry(tasks: Task[], day: string, now: Date) {
  return tasks.filter(
    (task) =>
      task.enabled &&
      !!task.eventAt &&
      Date.parse(task.eventAt) <= now.getTime() &&
      task.nextDue <= day,
  );
}

export function collectDailyReminders(
  state: State,
  safety: LocalSafety,
  now = new Date(),
): DailyReminderItems {
  const day = dayOf(state, now);
  // The old reminder counted every open occurrence from this week (due or
  // overdue), ignoring the daily minute block and Ťažký deň. That number is
  // not a goal. Speak only about today's rewarded time.
  return {
    day,
    line: state.households.length ? todayPace(state, now).line : null,
    laundry: pendingLaundry(state.tasks, day, now).length,
    backup: backupReminderDue(safety, now),
  };
}

export function visibleReminder(items: DailyReminderItems, page: string) {
  return {
    today: !!items.line,
    laundry: page !== "tasks" && items.laundry > 0,
    backup: page !== "profile" && items.backup,
  };
}
