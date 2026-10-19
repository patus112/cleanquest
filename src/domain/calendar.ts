import {
  addDays,
  addMonths,
  addYears,
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
// Howard Hinnant's civil day count. Same result as a UTC date difference,
// without constructing a Date on every comparison.
const dayNumber = (day: Day) => {
  let year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)),
    date = Number(day.slice(8, 10));
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400),
    yearOfEra = year - era * 400,
    dayOfYear =
      Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + date - 1,
    dayOfEra =
      yearOfEra * 365 +
      Math.floor(yearOfEra / 4) -
      Math.floor(yearOfEra / 100) +
      dayOfYear;
  return era * 146097 + dayOfEra - 719468;
};
// Scoring compares this for every task. Date-only keys differ by calendar days,
// including across DST, without parsing through date-fns on each call.
export const distance = (a: Day, b: Day) => dayNumber(a) - dayNumber(b);
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
