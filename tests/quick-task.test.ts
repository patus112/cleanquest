import { describe, expect, it } from "vitest";
import { fixture, day, now } from "./fixture";
import { addQuickTask } from "../src/domain/commands";
import { dailySession, ensurePlans } from "../src/domain/scheduler";
import { weekStart } from "../src/domain/calendar";
import { xpFor } from "../src/domain/model";

describe("quick task", () => {
  it("starts a one-off at the top of today and does not make it recurring", () => {
    const s = fixture();
    const before = s.weeks.find((week) => week.start === weekStart(day))!
      .required.length;
    const result = addQuickTask(
      s,
      { title: "Zložiť deku z pohovky", roomId: s.rooms[0].id, duration: 5 },
      "now",
      now,
    );
    const task = s.tasks.find((item) => item.id === result.taskId)!;
    expect(task.recurrence.unit).toBe("once");
    expect(task.tier).toBe(1);
    const today = s.dailyPlans.find((plan) => plan.date === day)!;
    expect(today.occurrences[0].id).toBe(result.occurrenceId);
    expect(today.occurrences[0].lead).toBe(true);
    expect(today.occurrences[0].title).toBe("Zložiť deku z pohovky");
    expect(
      s.weeks
        .find((week) => week.start === weekStart(day))!
        .required.some((item) => item.taskId === task.id),
    ).toBe(false);
    expect(
      s.weeks.find((week) => week.start === weekStart(day))!.required,
    ).toHaveLength(before);
    expect(dailySession(s, day, 15)[0].title).toBe("Zložiť deku z pohovky");
    ensurePlans(s, day, now.toISOString());
    expect(
      today.occurrences.filter((item) => item.taskId === task.id),
    ).toHaveLength(1);
  });

  it("keeps a recurring task only when asked", () => {
    const s = fixture();
    const result = addQuickTask(
      s,
      {
        title: "Vyniesť kôš v predsieni",
        roomId: s.rooms[0].id,
        keep: true,
      },
      "now",
      now,
    );
    expect(s.tasks.find((item) => item.id === result.taskId)?.recurrence).toMatchObject(
      { unit: "week", interval: 1, strategy: "completion" },
    );
  });

  it("records an already done task in today's history without a schedule", () => {
    const s = fixture();
    const result = addQuickTask(
      s,
      { title: "Odniesť taniere", roomId: s.rooms[0].id },
      "done",
      now,
    );
    const task = s.tasks.find((item) => item.id === result.taskId)!;
    const completion = s.completions.find((item) => item.taskId === task.id)!;
    expect(task.recurrence.unit).toBe("once");
    expect(task.nextDue).toBe("9999-12-31");
    expect(completion.day).toBe(day);
    expect(completion.undone).toBe(false);
    expect(completion.xp).toBe(xpFor(5));
    expect(completion.type).toBe("manual");
    expect(
      s.dailyPlans
        .flatMap((plan) => plan.occurrences)
        .some((item) => item.taskId === task.id),
    ).toBe(false);
    expect(
      s.weeks
        .flatMap((week) => week.required)
        .some((item) => item.taskId === task.id),
    ).toBe(false);
  });

  it("refuses another rewarded quick task when today's time is full", () => {
    const s = fixture();
    s.completions.push({
      id: "full",
      householdId: s.households[0].id,
      taskId: s.tasks[0].id,
      occurrenceId: "manual:full",
      title: "Už spravené",
      roomName: s.rooms[0].name,
      duration: s.settings[0].dailyBudget,
      completedAt: now.toISOString(),
      day,
      type: "manual",
      xp: xpFor(s.settings[0].dailyBudget),
      previousDue: day,
      nextDue: day,
      undone: false,
    });
    expect(() =>
      addQuickTask(
        s,
        { title: "Ešte jedna vec", roomId: s.rooms[0].id, duration: 5 },
        "done",
        now,
      ),
    ).toThrow(/body sú pokope/);
    expect(s.completions.some((item) => item.title === "Ešte jedna vec")).toBe(
      false,
    );
  });
});
