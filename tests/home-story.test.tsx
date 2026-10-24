import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { complete } from "../src/domain/commands";
import { xpFor, type Completion, type Occurrence } from "../src/domain/model";
import { homeCounters, homeStory, goalStreak } from "../src/domain/progress";
import { collectDailyReminders } from "../src/domain/reminders";
import { currentTasks } from "../src/domain/scheduler";
import { streak } from "../src/domain/rewards";
import { defaultSafety } from "../src/domain/localSafety";
import Dashboard from "../src/ui/Dashboard";
import { day, fixture, now } from "./fixture";

function manual(
  state: ReturnType<typeof fixture>,
  date: string,
  duration: number,
  index: number,
): Completion {
  return {
    id: `done-${date}-${index}`,
    householdId: state.households[0].id,
    taskId: `done-task-${date}-${index}`,
    occurrenceId: `manual:done-${date}-${index}`,
    title: "Hotový krok",
    roomName: state.rooms[0].name,
    duration,
    completedAt: `${date}T12:00:00.000Z`,
    day: date,
    type: "manual",
    xp: xpFor(duration),
    previousDue: date,
    nextDue: date,
    undone: false,
  };
}

function pile() {
  const state = fixture();
  state.settings[0].dailyBudget = 30;
  const plan = state.dailyPlans.find((item) => item.date === day)!;
  plan.timeBudget = 30;
  const sample = plan.occurrences[0];
  for (let index = 0; index < 12; index++)
    plan.occurrences.push({
      ...sample,
      id: `pile-${index}`,
      taskId: `pile-${index}`,
      title: `Navrch ${index}`,
      duration: 5,
      xp: 20,
    } satisfies Occurrence);
  for (let index = 0; index < 6; index++)
    state.completions.push(manual(state, day, 5, index));
  return state;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Domov tells one story", () => {
  it("derives every counter from today's minutes, not the open pile", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const state = pile();
    const open = currentTasks(state, day).length;
    expect(open).toBeGreaterThan(12);
    const story = homeStory(state, now);
    expect(story.goalMet).toBe(true);
    expect(story.ring).toBeNull();
    expect(story.headline).toBe("Dnešný cieľ splnený");
    expect(story.usedMinutes).toBe(30);
    expect(story.goalMinutes).toBe(30);
    expect(story.detail).toBe("Ak máš chuť, môžeš pokračovať bonusom.");
    expect(story.reminderLine).toBeNull();
    expect(collectDailyReminders(state, defaultSafety(), now).line).toBe(
      story.reminderLine,
    );
    expect(story.streakDays).toBeGreaterThan(0);
    expect(story.streakLabel).toBe("1 deň s denným cieľom");
    const counters = Object.values(homeCounters(story));
    expect(counters).not.toContain(open);
    expect(JSON.stringify(story)).not.toMatch(/zostáva|malých krokov/);

    render(
      <Dashboard
        s={state}
        open={() => {}}
        run={async () => true}
        navigate={() => {}}
      />,
    );
    expect(
      screen.getAllByRole("heading", { name: "Dnešný cieľ splnený" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(story.streakLabel)).toBeVisible();
    expect(screen.getByText(story.weekLine)).toBeVisible();
    expect(screen.getByText("cieľ splnený")).toBeVisible();
    expect(screen.queryByText("malých krokov")).toBeNull();
    expect(screen.queryByText(/zostáva \d+/)).toBeNull();
    expect(screen.queryByText(new RegExp(`/${open}`))).toBeNull();
    expect(screen.getAllByText(story.detail).length).toBeGreaterThan(0);
    expect(screen.getByText("bez bodov")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hotovo" })).toBeVisible();
    expect(screen.queryByText("Na dnes stačí. Pokračujeme zajtra.")).toBeNull();
  });

  it("shows minute progress while the goal is still open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const state = fixture();
    const session = state.dailyPlans
      .flatMap((plan) => plan.occurrences)
      .find((item) => item.date === day)!;
    complete(state, session.taskId, "required", session.id, now);
    const story = homeStory(state, now);
    const open = currentTasks(state, day).length;
    expect(story.goalMet).toBe(false);
    expect(story.ring).toEqual({ current: 3, goal: 10, unit: "min" });
    expect(story.headline).toBe("Kúsok po kúsku.");
    expect(story.hasStep).toBe(true);
    expect(story.reminderLine).toBe("Dnes ešte 1 malý krok.");
    expect(Object.values(homeCounters(story))).not.toContain(open);
    render(
      <Dashboard
        s={state}
        open={() => {}}
        run={async () => true}
        navigate={() => {}}
      />,
    );
    expect(screen.getByText("minút")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Kúsok po kúsku." })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Dnešný cieľ splnený" })).toBeNull();
    expect(screen.queryByText("malých krokov")).toBeNull();
    const minutes = screen.getAllByText(/3 \/ 10 min/);
    expect(minutes.length).toBeGreaterThan(1);
    for (const node of minutes) expect(node).toBeVisible();
  });

  it("counts a streak from full days even when leftover tasks stay on the plan", () => {
    const state = fixture();
    state.households[0].createdAt = "2026-10-01T00:00:00.000Z";
    state.settings[0].restDays = [0];
    const sample = state.dailyPlans[0].occurrences[0];
    for (const date of ["2026-10-08", "2026-10-09", "2026-10-10"]) {
      state.dailyPlans.push({
        ...state.dailyPlans[0],
        id: `plan-${date}`,
        date,
        timeBudget: 30,
        occurrences: [0, 1].map((index) => ({
          ...sample,
          id: `${date}-${index}`,
          taskId: `open-${date}-${index}`,
          date,
          duration: 5,
          xp: 20,
        })),
      });
      state.weeks[0].restDays = [0];
      state.completions.push(manual(state, date, 30, 0));
    }
    const saturday = new Date("2026-10-10T12:00:00.000Z");
    expect(goalStreak(state, "2026-10-10", saturday)).toBe(3);
    expect(streak(state, "2026-10-10")).toBe(3);
    const story = homeStory(state, saturday);
    expect(story.goalMet).toBe(true);
    expect(story.streakLabel).toBe("3 dni s denným cieľom");
    expect(currentTasks(state, "2026-10-10").length).toBeGreaterThan(0);
  });
});
