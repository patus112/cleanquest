import { describe, expect, it } from "vitest";
import { complete } from "../src/domain/commands";
import { xpFor, type Completion } from "../src/domain/model";
import {
  todayPace,
  weekPace,
  weekRewardLine,
} from "../src/domain/progress";
import { collectDailyReminders } from "../src/domain/reminders";
import { currentTasks } from "../src/domain/scheduler";
import { defaultSafety } from "../src/domain/localSafety";
import { day, fixture, makeTask, now } from "./fixture";

function filled(state: ReturnType<typeof fixture>, duration: number): Completion {
  return {
    id: `done-${duration}-${state.completions.length}`,
    householdId: state.households[0].id,
    taskId: "task-0",
    occurrenceId: `manual:done-${state.completions.length}@${day}`,
    title: "Hotový krok",
    roomName: state.rooms[0].name,
    duration,
    completedAt: now.toISOString(),
    day,
    type: "manual",
    xp: xpFor(duration),
    previousDue: day,
    nextDue: day,
    undone: false,
  };
}

describe("today and week progress", () => {
  it("speaks about one step today and never the open week count", () => {
    const state = fixture();
    const open = currentTasks(state, day);
    expect(open.length).toBeGreaterThan(1);
    const pace = todayPace(state, now);
    expect(pace.line).toBe("Dnes ešte 1 malý krok.");
    expect(pace.line).not.toContain(String(open.length));
    expect(pace.usedMinutes).toBe(0);
    expect(pace.goalMinutes).toBe(10);
    expect(pace.goalMet).toBe(false);
    expect(pace.totalXp).toBe(0);
  });

  it("celebrates when rewarded minutes are full even if the week still has a pile", () => {
    const state = fixture();
    const plan = state.dailyPlans.find((item) => item.date === day)!;
    const sample = plan.occurrences[0];
    for (let index = 0; index < 29; index++)
      plan.occurrences.push({
        ...sample,
        id: `pile-${index}`,
        taskId: `pile-task-${index}`,
        title: `Navrch ${index}`,
      });
    state.completions.push(filled(state, 10));
    const open = currentTasks(state, day);
    expect(open.length).toBeGreaterThanOrEqual(29);
    const pace = todayPace(state, now);
    expect(pace.timeFull).toBe(true);
    expect(pace.usedMinutes).toBe(10);
    expect(pace.todayXp).toBe(xpFor(10));
    expect(pace.line).toBe("Dnešný cieľ splnený 🎉");
    expect(pace.line).not.toContain("29");
    const items = collectDailyReminders(state, defaultSafety(), now);
    expect(items.line).toBe("Dnešný cieľ splnený 🎉");
    expect(JSON.stringify(items)).not.toMatch(/zostáva|týždňa|steps|overdue/);
  });

  it("keeps a hard day light after one rewarded step", () => {
    const state = fixture();
    state.settings[0].rescue = true;
    for (const task of state.tasks) task.tier = 1;
    expect(todayPace(state, now)).toMatchObject({
      rescue: true,
      hasStep: true,
      goalMet: false,
      line: "Dnes ešte 1 malý krok.",
    });
    state.completions.push(filled(state, 3));
    const pace = todayPace(state, now);
    expect(pace.timeFull).toBe(false);
    expect(pace.goalMet).toBe(true);
    expect(pace.todayXp).toBe(10);
    expect(pace.line).toBe("Dnešný cieľ splnený 🎉");
  });

  it("refuses a further manual reward instead of saving it without points", () => {
    const state = fixture();
    state.completions.push(filled(state, 10));
    const loose = makeTask(state, { id: "loose", duration: 3, nextDue: day });
    state.tasks.push(loose);
    const before = state.completions.length;
    expect(() => complete(state, loose.id, "manual", undefined, now)).toThrow(
      /Dnešné body sú pokope/,
    );
    expect(state.completions).toHaveLength(before);
    expect(state.completions.some((item) => item.xp === 0)).toBe(false);
  });

  it("counts weekly reward steps, not a DA target", () => {
    expect(weekRewardLine(1, 4, true)).toBe("Do týždennej odmeny chýba 1 krok.");
    expect(weekRewardLine(3, 4, true)).toBe(
      "Do týždennej odmeny chýbajú 3 kroky.",
    );
    expect(weekRewardLine(5, 8, true)).toBe(
      "Do týždennej odmeny chýba 5 krokov.",
    );
    expect(weekRewardLine(22, 30, true)).toBe(
      "Do týždennej odmeny chýbajú 22 kroky.",
    );
    expect(weekRewardLine(0, 4, true)).toBe("Týždenná odmena je tvoja.");
    expect(weekRewardLine(0, 0, true)).toBe("Tento týždeň je ľahší.");
    expect(weekRewardLine(2, 4, false)).toBe("V týždennom pláne ešte 2 kroky.");
    expect(weekRewardLine(0, 3, false)).toBe("Týždenný plán je pokope.");

    const state = fixture();
    const week = state.weeks[0];
    const sample = week.required[0];
    expect(sample).toBeTruthy();
    week.required = [1, 2, 3, 4, 5].map((index) => ({
      ...sample,
      id: `need-${index}`,
    }));
    week.rewardEnabled = true;
    expect(weekPace(state, now)).toMatchObject({
      done: 0,
      total: 5,
      remaining: 5,
      rewardEnabled: true,
      line: "Do týždennej odmeny chýba 5 krokov.",
    });
    state.completions.push({
      ...filled(state, 3),
      id: "week-step",
      type: "required",
      occurrenceId: "need-1",
    });
    expect(weekPace(state, now).line).toBe(
      "Do týždennej odmeny chýbajú 4 kroky.",
    );
    week.rewardEnabled = false;
    expect(weekPace(state, now).line).toBe("V týždennom pláne ešte 4 kroky.");
  });
});
