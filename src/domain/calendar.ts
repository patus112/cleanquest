import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import type { Day, Recurrence } from "./model";
export const dateKey = (d: Date) => format(d, "yyyy-MM-dd");
export const todayIn = (timezone: string, now = new Date()): Day =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const shiftDay = (day: Day, n: number) =>
  dateKey(addDays(parseISO(day), n));
export const weekday = (day: Day) => getDay(parseISO(day));
export const weekStart = (day: Day) =>
  dateKey(startOfWeek(parseISO(day), { weekStartsOn: 1 }));
export const distance = (a: Day, b: Day) =>
  differenceInCalendarDays(parseISO(a), parseISO(b));
function increment(anchor: Day, r: Recurrence, n: number): Day {
  const d = parseISO(anchor),
    count = r.interval * n;
  return dateKey(
    r.unit === "month"
      ? addMonths(d, count)
      : r.unit === "year"
        ? addYears(d, count)
        : addDays(d, count * (r.unit === "week" ? 7 : 1)),
  );
}
export function nextOccurrence(r: Recurrence, completed: Day): Day {
  if (r.unit === "once") return "9999-12-31";
  if (r.strategy === "completion") return increment(completed, r, 1);
  let anchor = r.anchor;
  if (r.preferredDay !== undefined && r.unit === "week")
    anchor = shiftDay(anchor, (r.preferredDay - weekday(anchor) + 7) % 7);
  if (anchor > completed) return anchor;
  // Fixed anchor prevents Jan 31 -> Feb 28 -> Mar 28 drift.
  let n =
    r.unit === "day" || r.unit === "week"
      ? Math.max(
          1,
          Math.floor(
            distance(completed, anchor) /
              (r.interval * (r.unit === "week" ? 7 : 1)),
          ),
        )
      : 1;
  while (increment(anchor, r, n) <= completed) n++;
  return increment(anchor, r, n);
}
export function recurrenceLabel(r: Recurrence): string {
  const every = (few: string, many: string) =>
    r.interval >= 2 && r.interval <= 4
      ? `Každé ${r.interval} ${few}`
      : `Každých ${r.interval} ${many}`;
  if (r.unit === "once") return "Jednorazovo";
  if (r.unit === "day") return r.interval === 1 ? "Denne" : every("dni", "dní");
  if (r.unit === "week") {
    if (r.strategy === "calendar" && r.preferredDay !== undefined)
      return `${r.interval === 1 ? "Každý týždeň" : every("týždne", "týždňov")} · ${["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"][r.preferredDay]}`;
    return r.interval === 1 ? "Týždenne" : every("týždne", "týždňov");
  }
  if (r.unit === "month")
    return r.interval === 1 ? "Mesačne" : every("mesiace", "mesiacov");
  return r.interval === 1 ? "Ročne" : every("roky", "rokov");
}
