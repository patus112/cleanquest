import type { State, Task } from "./model";
import { dayOf } from "./commands";
import { backupReminderDue, type LocalSafety } from "./localSafety";
import { currentTasks } from "./scheduler";

export interface DailyReminderItems {
  day: string;
  steps: number;
  overdue: number;
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

export function questLine(steps: number) {
  const form = countForm(steps);
  if (form === "one") return `Na dnes zostáva ${steps} krok.`;
  if (form === "few") return `Na dnes zostávajú ${steps} kroky.`;
  return `Na dnes zostáva ${steps} krokov.`;
}

export function overdueLine(count: number) {
  if (count === 1) return "Jeden je ešte z tohto týždňa.";
  if (countForm(count) === "few") return `${count} sú ešte z tohto týždňa.`;
  return `${count} je ešte z tohto týždňa.`;
}

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
  const open = state.households.length ? currentTasks(state, day) : [];
  return {
    day,
    steps: open.length,
    overdue: open.filter((item) => item.date < day).length,
    laundry: pendingLaundry(state.tasks, day, now).length,
    backup: backupReminderDue(safety, now),
  };
}

export function visibleReminder(items: DailyReminderItems, page: string) {
  return {
    steps: items.steps > 0,
    laundry: page !== "tasks" && items.laundry > 0,
    backup: page !== "profile" && items.backup,
  };
}
