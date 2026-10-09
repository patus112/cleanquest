import type { State } from "./model";
import { uid } from "./model";
import { completedIds } from "./scheduler";
import { shiftDay, weekday, weekStart } from "./calendar";
export const totalXp = (s: State) =>
  s.completions.filter((c) => !c.undone).reduce((n, c) => n + c.xp, 0) +
  s.bonuses.filter((b) => b.awarded).length * 100 +
  s.megas.filter((m) => m.awarded).length * 500;
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const floor = (level - 1) ** 2 * 100,
    ceiling = level ** 2 * 100;
  return {
    level,
    progress: (xp - floor) / (ceiling - floor),
    remaining: ceiling - xp,
    ceiling,
    floor,
  };
}
export const balance = (s: State) => s.rewards.reduce((n, r) => n + r.cents, 0);
function grant(
  s: State,
  sourceId: string,
  target: number,
  type: "weekly" | "bonus",
  description: string,
  now: string,
) {
  const current = s.rewards
      .filter((r) => r.sourceId === sourceId)
      .reduce((n, r) => n + r.cents, 0),
    delta = target - current;
  if (!delta) return;
  s.rewards.push({
    id: uid(),
    householdId: s.households[0].id,
    type: delta > 0 ? type : "correction",
    cents: delta,
    sourceId,
    createdAt: now,
    description: delta < 0 ? `Oprava: ${description}` : description,
  });
}
export function reconcile(s: State, now = new Date().toISOString()): void {
  const completed = completedIds(s);
  for (const week of s.weeks) {
    const done =
      week.required.length > 0 &&
      week.required.every((o) => completed.has(o.id));
    grant(
      s,
      week.id,
      done && week.rewardEnabled ? week.rewardCents : 0,
      "weekly",
      "Týždenný plán",
      now,
    );
    if (done) week.rewardIssuedAt = week.rewardIssuedAt || now;
    else delete week.rewardIssuedAt;
  }
  for (const bonus of s.bonuses) {
    bonus.awarded =
      bonus.steps.length > 0 && bonus.steps.every((st) => st.done);
    grant(
      s,
      bonus.id,
      bonus.awarded && bonus.monetaryEnabled ? bonus.rewardCents : 0,
      "bonus",
      "Dobrovoľná týždenná výzva",
      now,
    );
  }
  for (const mega of s.megas) {
    mega.awarded = mega.steps.length >= 3 && mega.steps.every((st) => st.done);
    if (mega.problemId) {
      const p = s.problems.find((p) => p.id === mega.problemId);
      if (p) {
        p.status = mega.awarded ? "Vyriešené" : "Rozpracované";
        if (mega.awarded) p.completedAt = now;
        else delete p.completedAt;
      }
    }
  }
  const count = s.completions.filter(
    (c) => !c.undone && c.type !== "extra",
  ).length;
  const awards = [
    ["first", "Prvý malý krok", count >= 1],
    ["ten", "Desať krokov k pokoju", count >= 10],
    ["fifty", "Domov v rytme", count >= 50],
    ["mega", "Vyriešené doma", s.megas.some((m) => m.awarded)],
  ] as const;
  for (const [id, title, eligible] of awards) {
    const key = `${s.households[0].id}:${id}`;
    if (eligible && !s.achievements.some((a) => a.id === key))
      s.achievements.push({
        id: key,
        householdId: s.households[0].id,
        title,
        unlockedAt: now,
      });
    if (!eligible) s.achievements = s.achievements.filter((a) => a.id !== key);
  }
}
export function streak(s: State, day: string) {
  let count = 0,
    date = day;
  const ids = completedIds(s);
  for (let i = 0; i < 3660; i++, date = shiftDay(date, -1)) {
    if (date < s.households[0].createdAt.slice(0, 10)) break;
    const week = s.weeks.find((w) => w.start === weekStart(date));
    if ((week?.restDays || s.settings[0].restDays).includes(weekday(date)))
      continue;
    const plan = s.dailyPlans.find((p) => p.date === date);
    if (
      plan?.occurrences.length &&
      plan.occurrences.every((o) => ids.has(o.id))
    ) {
      count++;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return count;
}
