import type { State } from "./model";
import { shiftDay, todayIn, weekday, weekStart } from "./calendar";
import { dailySession, completedIds } from "./scheduler";

export interface TodayPace {
  usedMinutes: number;
  goalMinutes: number;
  todayXp: number;
  totalXp: number;
  rescue: boolean;
  /** Rewarded minutes, not extra, have filled today's block. */
  timeFull: boolean;
  /** One task still fits in the minutes that are left. */
  hasStep: boolean;
  /** Full minutes, or one rewarded step on a hard day. */
  goalMet: boolean;
  /** Gentle line for the reminder. Never a week-long backlog count. */
  line: string | null;
}

export interface WeekPace {
  done: number;
  total: number;
  remaining: number;
  rewardEnabled: boolean;
  rewardCents: number;
  line: string;
}

const countForm = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "many";
  const mod10 = n % 10;
  if (mod10 === 1) return "one";
  if (mod10 >= 2 && mod10 <= 4) return "few";
  return "many";
};

export function weekRewardLine(
  remaining: number,
  total: number,
  rewardEnabled: boolean,
) {
  if (total <= 0) return "Tento týždeň je ľahší.";
  if (remaining <= 0)
    return rewardEnabled
      ? "Týždenná odmena je tvoja."
      : "Týždenný plán je pokope.";
  const form = countForm(remaining);
  if (!rewardEnabled) {
    if (form === "one") return "V týždennom pláne ešte 1 krok.";
    if (form === "few") return `V týždennom pláne ešte ${remaining} kroky.`;
    return `V týždennom pláne ešte ${remaining} krokov.`;
  }
  if (form === "one") return "Do týždennej odmeny chýba 1 krok.";
  if (form === "few") return `Do týždennej odmeny chýbajú ${remaining} kroky.`;
  return `Do týždennej odmeny chýba ${remaining} krokov.`;
}

const emptyPace = (): TodayPace => ({
  usedMinutes: 0,
  goalMinutes: 0,
  todayXp: 0,
  totalXp: 0,
  rescue: false,
  timeFull: false,
  hasStep: false,
  goalMet: false,
  line: null,
});

/** Today's rewarded minutes and the light hard-day goal. Ignores the week backlog. */
export function todayPace(state: State, now = new Date()): TodayPace {
  const settings = state.settings[0];
  const household = state.households[0];
  if (!settings || !household) return emptyPace();
  const day = todayIn(household.timezone, now);
  const plan = state.dailyPlans.find((item) => item.date === day);
  const goalMinutes = plan?.timeBudget ?? settings.dailyBudget;
  const rewarded = state.completions.filter(
    (item) => !item.undone && item.day === day && item.type !== "extra",
  );
  const usedMinutes = rewarded.reduce((sum, item) => sum + item.duration, 0);
  const earned = rewarded.reduce((sum, item) => sum + item.xp, 0);
  const rescue = !!settings.rescue;
  const timeFull = goalMinutes > 0 && usedMinutes >= goalMinutes;
  const hasStep = !timeFull && dailySession(state, day).length > 0;
  // Minutes fill the block, a hard day settles after one rewarded step,
  // the locked plan is done, or nothing offered still fits.
  const goalMet =
    dayGoalMet(state, day, rescue) || (!hasStep && usedMinutes > 0);
  let line: string | null = null;
  if (goalMet) line = "Dnešný cieľ splnený 🎉";
  else if (hasStep) line = "Dnes ešte 1 malý krok.";
  return {
    usedMinutes,
    goalMinutes,
    todayXp: earned,
    totalXp: earnedXp(state),
    rescue,
    timeFull,
    hasStep,
    goalMet,
    line,
  };
}

/** Steps left in this week's required plan. The reward is those steps, not a DA quota. */
export function weekPace(state: State, now = new Date()): WeekPace {
  const household = state.households[0];
  if (!household)
    return {
      done: 0,
      total: 0,
      remaining: 0,
      rewardEnabled: false,
      rewardCents: 0,
      line: weekRewardLine(0, 0, false),
    };
  const day = todayIn(household.timezone, now);
  const week = state.weeks.find((item) => item.start === weekStart(day));
  const ids = completedIds(state);
  const total = week?.required.length ?? 0;
  const done = week?.required.filter((item) => ids.has(item.id)).length ?? 0;
  const remaining = Math.max(0, total - done);
  const rewardEnabled = !!week?.rewardEnabled;
  return {
    done,
    total,
    remaining,
    rewardEnabled,
    rewardCents: week?.rewardCents ?? 0,
    line: weekRewardLine(remaining, total, rewardEnabled),
  };
}

const earnedXp = (state: State) =>
  state.completions
    .filter((item) => !item.undone)
    .reduce((sum, item) => sum + item.xp, 0) +
  state.bonuses.filter((item) => item.awarded).length * 100 +
  state.megas.filter((item) => item.awarded).length * 500;

const rewardedOn = (state: State, date: string) =>
  state.completions.filter(
    (item) => !item.undone && item.day === date && item.type !== "extra",
  );

/** A day counts when its rewarded minutes are full, or its own plan is done. */
export function dayGoalMet(state: State, date: string, rescue = false) {
  const settings = state.settings[0];
  if (!settings) return false;
  const plan = state.dailyPlans.find((item) => item.date === date);
  const budget = plan?.timeBudget ?? settings.dailyBudget;
  const rewarded = rewardedOn(state, date);
  const used = rewarded.reduce((sum, item) => sum + item.duration, 0);
  if (budget > 0 && used >= budget) return true;
  if (rescue && rewarded.length > 0) return true;
  const ids = completedIds(state);
  return (
    !!plan?.occurrences.length &&
    plan.occurrences.every((item) => ids.has(item.id))
  );
}

/** Consecutive days whose goal was met. Rest days stay in the chain. The open day waits. */
export function goalStreak(state: State, day: string, now = new Date()) {
  const settings = state.settings[0];
  const household = state.households[0];
  if (!settings || !household || !day) return 0;
  // `day` is the as-of date. The clock only supplies today's soft "nothing fits" goal.
  const clockDay = todayIn(household.timezone, now);
  let count = 0;
  let date = day;
  for (let index = 0; index < 3660; index++, date = shiftDay(date, -1)) {
    if (date < household.createdAt.slice(0, 10)) break;
    const week = state.weeks.find((item) => item.start === weekStart(date));
    if ((week?.restDays || settings.restDays).includes(weekday(date))) continue;
    const met =
      date === clockDay
        ? todayPace(state, now).goalMet
        : dayGoalMet(state, date);
    if (met) {
      count++;
      continue;
    }
    if (index === 0) continue;
    break;
  }
  return count;
}

export function streakLabel(days: number) {
  if (days <= 0) return "Denný cieľ zatiaľ bez rady";
  const form = countForm(days);
  if (form === "one") return "1 deň s denným cieľom";
  if (form === "few") return `${days} dni s denným cieľom`;
  return `${days} dní s denným cieľom`;
}

export interface HomeRing {
  current: number;
  goal: number;
  unit: "min";
}

/** Every number Domov is allowed to show about today and the week. */
export interface HomeStory {
  day: string;
  usedMinutes: number;
  goalMinutes: number;
  todayXp: number;
  totalXp: number;
  rescue: boolean;
  rest: boolean;
  goalMet: boolean;
  hasStep: boolean;
  progress: number;
  /** Absent once the goal is met, so the ring cannot fall back to a task pile. */
  ring: HomeRing | null;
  headline: string;
  detail: string;
  reminderLine: string | null;
  streakDays: number;
  streakLabel: string;
  weekLine: string;
  weekDone: number;
  weekTotal: number;
}

export function homeCounters(story: HomeStory) {
  return {
    usedMinutes: story.usedMinutes,
    goalMinutes: story.goalMinutes,
    todayXp: story.todayXp,
    totalXp: story.totalXp,
    streakDays: story.streakDays,
    weekDone: story.weekDone,
    weekTotal: story.weekTotal,
    ringCurrent: story.ring?.current ?? null,
    ringGoal: story.ring?.goal ?? null,
  };
}

export function homeStory(state: State, now = new Date()): HomeStory {
  const pace = todayPace(state, now);
  const week = weekPace(state, now);
  const household = state.households[0];
  const day = household ? todayIn(household.timezone, now) : "";
  const restDays =
    state.weeks.find((item) => item.start === weekStart(day))?.restDays ??
    state.settings[0]?.restDays ??
    [];
  const rest = !!day && restDays.includes(weekday(day));
  const streakDays = goalStreak(state, day, now);
  const progress = pace.goalMet
    ? 1
    : pace.goalMinutes > 0
      ? Math.min(1, pace.usedMinutes / pace.goalMinutes)
      : 0;
  let headline = "Kúsok po kúsku.";
  let detail = "Nemusíš zvládnuť všetko. Začni jednou malou vecou.";
  if (pace.goalMet) {
    headline = "Dnešný cieľ splnený";
    detail = "Dnešný čas je pokope. Ďalšie je len bonus, keď budeš chcieť.";
  } else if (rest) {
    headline = "Dnes máš voľno.";
    detail = "Oddych patrí do tvojho plánu.";
  } else if (!pace.hasStep) {
    headline = "Dnes je pokoj.";
    detail = "Na dnes už nie je ďalší odmeňovaný krok.";
  }
  return {
    day,
    usedMinutes: pace.usedMinutes,
    goalMinutes: pace.goalMinutes,
    todayXp: pace.todayXp,
    totalXp: pace.totalXp,
    rescue: pace.rescue,
    rest,
    goalMet: pace.goalMet,
    hasStep: pace.hasStep && !pace.goalMet,
    progress,
    ring: pace.goalMet
      ? null
      : {
          current: pace.usedMinutes,
          goal: pace.goalMinutes,
          unit: "min",
        },
    headline,
    detail,
    reminderLine: pace.line,
    streakDays,
    streakLabel: streakLabel(streakDays),
    weekLine: week.line,
    weekDone: week.done,
    weekTotal: week.total,
  };
}
