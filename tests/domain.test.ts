import { describe, it, expect } from "vitest";
import {
  nextOccurrence,
  todayIn,
  shiftDay,
  weekStart,
} from "../src/domain/calendar";
import {
  ensurePlans,
  pickTasks,
  currentTasks,
  completedIds,
  dailySession,
} from "../src/domain/scheduler";
import {
  complete,
  undo,
  saveTask,
  deleteTask,
  duplicateTask,
  splitTask,
  postpone,
  replaceOccurrence,
  extraOptions,
  redeem,
  createMega,
  propose,
  replaceBonus,
  deleteRoom,
} from "../src/domain/commands";
import {
  totalXp,
  levelFor,
  balance,
  reconcile,
  streak,
} from "../src/domain/rewards";
import { uid, xpFor, type Recurrence } from "../src/domain/model";
import { templates, generateTasks } from "../src/data/templates";
import {
  validateState,
  exportBackup,
  importBackup,
} from "../src/persistence/validation";
import { fixture, makeTask, now, day } from "./fixture";
const r = (patch: Partial<Recurrence> = {}): Recurrence => ({
  unit: "day",
  interval: 1,
  strategy: "completion",
  anchor: day,
  ...patch,
});
const finish = (s: ReturnType<typeof fixture>) => {
  for (const o of s.weeks[0].required)
    complete(s, o.taskId, "required", o.id, new Date(o.date + "T12:00:00Z"));
};
describe("calendar recurrence", () => {
  it.each([
    [1, "2026-10-06"],
    [2, "2026-10-07"],
    [3, "2026-10-08"],
    [7, "2026-10-12"],
    [17, "2026-10-22"],
  ])("completion every %i days", (interval, expected) =>
    expect(nextOccurrence(r({ interval }), day)).toBe(expected),
  );
  it.each([
    [1, "2026-10-12"],
    [2, "2026-10-19"],
  ])("weeks %i", (interval, expected) =>
    expect(nextOccurrence(r({ unit: "week", interval }), day)).toBe(expected),
  );
  it.each([
    [1, "2026-02-28"],
    [2, "2026-03-31"],
    [3, "2026-04-30"],
    [6, "2026-07-31"],
  ])("months %i clamp", (interval, expected) =>
    expect(nextOccurrence(r({ unit: "month", interval }), "2026-01-31")).toBe(
      expected,
    ),
  );
  it("calendar returns to original month day after February", () =>
    expect(
      nextOccurrence(
        r({ unit: "month", strategy: "calendar", anchor: "2026-01-31" }),
        "2026-02-28",
      ),
    ).toBe("2026-03-31"));
  it("leap year yearly completion", () =>
    expect(nextOccurrence(r({ unit: "year" }), "2024-02-29")).toBe(
      "2025-02-28",
    ));
  it("leap year calendar anchor returns to leap day", () =>
    expect(
      nextOccurrence(
        r({ unit: "year", strategy: "calendar", anchor: "2024-02-29" }),
        "2027-03-01",
      ),
    ).toBe("2028-02-29"));
  it("missed calendar intervals skip backlog", () =>
    expect(
      nextOccurrence(r({ unit: "week", strategy: "calendar" }), "2026-12-31"),
    ).toBe("2027-01-04"));
  it("preferred Monday fixed calendar", () =>
    expect(
      nextOccurrence(
        r({
          unit: "week",
          strategy: "calendar",
          anchor: "2026-10-06",
          preferredDay: 1,
        }),
        "2026-10-12",
      ),
    ).toBe("2026-10-19"));
  it("one-time stays in library but never due again", () =>
    expect(nextOccurrence(r({ unit: "once" }), day)).toBe("9999-12-31"));
  it("DST does not shift a date-only recurrence", () =>
    expect(shiftDay("2026-10-25", 1)).toBe("2026-10-26"));
  it("household time zone survives travel", () => {
    expect(todayIn("Europe/Bratislava", new Date("2026-10-05T23:30:00Z"))).toBe(
      "2026-10-06",
    );
    expect(todayIn("America/New_York", new Date("2026-10-05T23:30:00Z"))).toBe(
      "2026-10-05",
    );
  });
  it("Monday–Sunday cycle", () =>
    expect(weekStart("2026-10-11")).toBe("2026-10-05"));
});
describe("scheduling", () => {
  it.each([5, 10, 15, 20, 30])("fits %i minute budget", (budget) => {
    const s = fixture(false),
      chosen = pickTasks(s, day, s.tasks, budget);
    expect(chosen.reduce((n, t) => n + t.duration, 0)).toBeLessThanOrEqual(
      budget,
    );
  });
  it("keeps the weekly snapshot stable after task edits and settings changes", () => {
    const s = fixture(),
      snapshot = structuredClone(s.weeks);
    s.tasks[0].title = "Nový názov";
    s.settings[0].dailyBudget = 5;
    ensurePlans(s, day);
    expect(s.weeks).toEqual(snapshot);
  });
  it("no duplicate occurrence across repeated plan calls", () => {
    const s = fixture();
    ensurePlans(s, day);
    ensurePlans(s, day);
    const ids = s.dailyPlans.flatMap((p) => p.occurrences.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.weeks).toHaveLength(1);
  });
  it("respects rest days", () => {
    const s = fixture();
    ensurePlans(s, "2026-10-06");
    expect(
      s.dailyPlans.find((p) => p.date === "2026-10-06")!.occurrences,
    ).toEqual([]);
  });
  it("overdue work is bounded", () => {
    const s = fixture(false);
    s.tasks = Array.from({ length: 80 }, () =>
      makeTask(s, { nextDue: "2025-01-01" }),
    );
    ensurePlans(s, day);
    expect(s.weeks[0].required).toHaveLength(3);
  });
  it("paused/disabled and future tasks excluded", () => {
    const s = fixture(false);
    s.tasks.forEach((t) => (t.enabled = false));
    s.tasks[0].enabled = true;
    s.tasks[0].nextDue = "2027-01-01";
    expect(pickTasks(s, day, s.tasks, 30)).toEqual([]);
  });
  it("rotates rooms for equal urgency", () => {
    const s = fixture(false);
    s.tasks.forEach((t) => (t.priority = 2));
    const room = { ...s.rooms[0], id: uid(), name: "Druhá izba", order: 1 };
    s.rooms.push(room);
    s.tasks.push(makeTask(s, { id: "aaa", roomId: room.id }));
    expect(
      new Set(pickTasks(s, day, s.tasks, 10).map((t) => t.roomId)).size,
    ).toBe(2);
  });
  it("low energy avoids high energy tasks", () => {
    const s = fixture(false);
    s.settings[0].energy = 1;
    s.tasks.forEach((t) => (t.energy = 3));
    expect(pickTasks(s, day, s.tasks, 15)).toEqual([]);
  });
  it("postpones without shrinking week snapshot", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    postpone(s, o.id, "2026-10-06");
    expect(currentTasks(s, day).some((x) => x.id === o.id)).toBe(false);
    expect(s.weeks[0].required).toHaveLength(3);
    expect(currentTasks(s, "2026-10-06").some((x) => x.id === o.id)).toBe(true);
  });
  it("replacement preserves required identity and budget", () => {
    const s = fixture(),
      old = s.weeks[0].required[0];
    replaceOccurrence(s, old.id, day);
    expect(s.weeks[0].required[0].id).toBe(old.id);
    expect(s.weeks[0].required[0].taskId).not.toBe(old.taskId);
    expect(s.weeks[0].required[0].duration).toBeLessThanOrEqual(old.duration);
  });
  it("cannot replace completed task", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    complete(s, o.taskId, "required", o.id, now);
    expect(() => replaceOccurrence(s, o.id, day)).toThrow();
  });
  it("can replace a current task with overdue work from a missed earlier week", () => {
    const s = fixture(),
      previousWeek = structuredClone(s.weeks[0]);
    s.tasks.forEach((t, i) => {
      t.priority = i >= 3 ? 3 : 1;
    });
    s.tasks[6].enabled = false;
    ensurePlans(s, "2026-10-12");
    const current = s.weeks[1],
      original = current.required[0];
    replaceOccurrence(s, original.id, "2026-10-12");
    expect(current.required[0].id).toBe(original.id);
    expect(previousWeek.required.map((o) => o.taskId)).toContain(
      current.required[0].taskId,
    );
    expect(s.weeks[0]).toEqual(previousWeek);
    expect(current.required[0].duration).toBeLessThanOrEqual(original.duration);
  });
  it("remaining time in a five-minute block is bounded", () => {
    const s = fixture(),
      o = dailySession(s, day, 5)[0];
    complete(s, o.taskId, "required", o.id, now);
    expect(dailySession(s, day, 5)).toEqual([]);
  });
});
describe("task CRUD and configuration", () => {
  it("creates and edits a custom object task", () => {
    const s = fixture();
    const obj = {
      ...s.objects[0],
      id: uid(),
      category: "speaker" as const,
      name: "Reproduktor",
    };
    s.objects.push(obj);
    const t = makeTask(s, {
      objectId: obj.id,
      title: "Utrieť reproduktory zhora",
      recurrence: r({ interval: 7 }),
    });
    saveTask(s, t);
    saveTask(s, { ...t, title: "Utrieť jeden reproduktor" });
    expect(s.tasks.find((x) => x.id === t.id)?.objectId).toBe(obj.id);
    expect(s.tasks.find((x) => x.id === t.id)?.title).toBe(
      "Utrieť jeden reproduktor",
    );
  });
  it("delete cannot remove required snapshot", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    deleteTask(s, o.taskId);
    expect(s.weeks[0].required.some((x) => x.id === o.id)).toBe(true);
    complete(s, o.taskId, "required", o.id, now);
    expect(completedIds(s).has(o.id)).toBe(true);
  });
  it("duplicate is independent", () => {
    const s = fixture();
    duplicateTask(s, s.tasks[0].id);
    expect(s.tasks).toHaveLength(8);
    expect(s.tasks[7].id).not.toBe(s.tasks[0].id);
  });
  it("requires explicit acceptance for long tasks", () => {
    const s = fixture();
    expect(() => saveTask(s, makeTask(s, { duration: 20 }))).toThrow();
    saveTask(s, makeTask(s, { duration: 20, acceptedLong: true }));
  });
  it("splits large task into small independent actions and pauses parent", () => {
    const s = fixture(),
      t = makeTask(s, { duration: 20, acceptedLong: true });
    saveTask(s, t);
    splitTask(s, t.id, [
      "Prvá polica",
      "Druhá polica",
      "Tretia polica",
      "Štvrtá polica",
    ]);
    expect(s.tasks.find((x) => x.id === t.id)?.enabled).toBe(false);
    expect(s.tasks.slice(-4).every((t) => t.duration === 5)).toBe(true);
  });
  it("rejects object from another room", () => {
    const s = fixture();
    const obj = { ...s.objects[0], id: uid(), roomId: "other" };
    s.objects.push(obj);
    expect(() => saveTask(s, makeTask(s, { objectId: obj.id }))).toThrow();
  });
  it("library has at least 180 unique, detailed Slovak micro templates", () => {
    expect(templates.length).toBeGreaterThanOrEqual(180);
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect(
      templates.every(
        (t) =>
          t.duration <= 10 && t.instructions.length > 40 && t.title.length > 10,
      ),
    ).toBe(true);
  });
  it("does not invent appliances, panels or furniture", () => {
    const s = fixture();
    expect(generateTasks(s).every((t) => t.objectId === s.objects[0].id)).toBe(
      true,
    );
    expect(
      generateTasks(s).some((t) => t.templateId?.startsWith("dryer")),
    ).toBe(false);
  });
  it("prevents generated duplicates", () => {
    const s = fixture();
    s.tasks.push(...generateTasks(s));
    expect(generateTasks(s)).toEqual([]);
  });
  it("does not schedule unsafe glass access", () => {
    const s = fixture();
    s.objects.push({
      ...s.objects[0],
      id: uid(),
      category: "glass",
      accessibility: "unsafe",
    });
    expect(
      generateTasks(s).some((t) => t.templateId?.startsWith("glass")),
    ).toBe(false);
  });
  it("room deletion preserves histories and obligations", () => {
    const s = fixture();
    deleteRoom(s, s.rooms[0].id);
    expect(s.tasks).toEqual([]);
    expect(s.weeks[0].required).toHaveLength(3);
    expect(() => validateState(s)).not.toThrow();
  });
});
describe("DA, rewards and undo", () => {
  it.each([
    [1, 10],
    [3, 10],
    [4, 20],
    [5, 20],
    [6, 35],
    [10, 35],
    [15, 50],
  ])("duration %i -> %i DA", (duration, xp) =>
    expect(xpFor(duration)).toBe(xp),
  );
  it("levels progress correctly", () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(400).level).toBe(3);
    expect(levelFor(125).progress).toBeCloseTo(25 / 300);
  });
  it("awards once on repeated completion", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    complete(s, o.taskId, "required", o.id, now);
    complete(s, o.taskId, "required", o.id, now);
    expect(totalXp(s)).toBe(10);
    expect(s.completions).toHaveLength(1);
    expect(s.achievements).toHaveLength(1);
  });
  it("recurring task remains and advances from actual completion", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    complete(s, o.taskId, "required", o.id, new Date("2026-10-07T12:00Z"));
    expect(s.tasks.find((t) => t.id === o.taskId)?.nextDue).toBe("2026-10-14");
  });
  it("rejects completing future plan early", () => {
    const s = fixture(false);
    s.settings[0].restDays = [];
    s.tasks[0].recurrence = r();
    ensurePlans(s, day);
    const o = s.weeks[0].required.find((o) => o.date > day)!;
    expect(() => complete(s, o.taskId, "required", o.id, now)).toThrow();
  });
  it("no main reward for incomplete plan", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    complete(s, o.taskId, "required", o.id, now);
    expect(balance(s)).toBe(0);
  });
  it("full weekly plan awards 2000 cents exactly once", () => {
    const s = fixture();
    finish(s);
    reconcile(s);
    expect(balance(s)).toBe(2000);
    expect(s.rewards).toHaveLength(1);
  });
  it("empty/rest-only plan does not award money", () => {
    const s = fixture(false);
    s.settings[0].restDays = [0, 1, 2, 3, 4, 5, 6];
    ensurePlans(s, day);
    reconcile(s);
    expect(balance(s)).toBe(0);
  });
  it("bonus is independent: 100 DA and 500 cents", () => {
    const s = fixture();
    s.bonuses[0].steps.forEach((st) => (st.done = true));
    reconcile(s);
    reconcile(s);
    expect(totalXp(s)).toBe(100);
    expect(balance(s)).toBe(500);
    expect(completedIds(s).size).toBe(0);
  });
  it("main + bonus maximum is 2500 cents", () => {
    const s = fixture();
    finish(s);
    s.bonuses[0].steps.forEach((st) => (st.done = true));
    reconcile(s);
    expect(balance(s)).toBe(2500);
  });
  it("disabled monetary rewards still award DA for bonus", () => {
    const s = fixture(false);
    s.settings[0].monetary = false;
    ensurePlans(s, day);
    finish(s);
    s.bonuses[0].steps.forEach((st) => (st.done = true));
    reconcile(s);
    expect(balance(s)).toBe(0);
    expect(totalXp(s)).toBe(130);
  });
  it("partial redemption carries balance and uses integer cents", () => {
    const s = fixture();
    finish(s);
    redeem(s, 735, "Kniha");
    expect(balance(s)).toBe(1265);
    ensurePlans(s, "2026-10-12");
    expect(balance(s)).toBe(1265);
    expect(() => redeem(s, 0.2, "Nie")).toThrow();
    expect(() => redeem(s, 2000, "Nie")).toThrow();
  });
  it("undo reverses DA and reward; redo restores precisely once", () => {
    const s = fixture();
    finish(s);
    const c = s.completions[0];
    undo(s, c.id);
    expect(balance(s)).toBe(0);
    expect(totalXp(s)).toBe(20);
    complete(s, c.taskId, "required", c.occurrenceId, now);
    reconcile(s);
    expect(balance(s)).toBe(2000);
    expect(totalXp(s)).toBe(30);
  });
  it("undo after redemption records debt and blocks overspend", () => {
    const s = fixture();
    finish(s);
    redeem(s, 1000, "Káva");
    undo(s, s.completions[0].id);
    expect(balance(s)).toBe(-1000);
    expect(() => redeem(s, 1, "Nie")).toThrow();
  });
  it("undo bonus independently corrects money and DA", () => {
    const s = fixture();
    finish(s);
    s.bonuses[0].steps.forEach((st) => (st.done = true));
    reconcile(s);
    s.bonuses[0].steps[0].done = false;
    reconcile(s);
    expect(balance(s)).toBe(2000);
    expect(totalXp(s)).toBe(30);
  });
  it("streak honors planned rest days", () => {
    const s = fixture();
    finish(s);
    expect(streak(s, "2026-10-07")).toBe(1);
  });
  it("bonus replacements never issue rewards", () => {
    const s = fixture();
    replaceBonus(s, day);
    replaceBonus(s, day);
    expect(balance(s)).toBe(0);
    expect(s.bonuses).toHaveLength(1);
  });
  it("manual DA is bounded by daily budget", () => {
    const s = fixture();
    finish(s);
    const t = extraOptions(s, day)[0];
    expect(() => complete(s, t.id, "manual", undefined, now)).toThrow();
  });
});
describe("extra energy", () => {
  it("allows offered overdue extras without completing or rewarding an old weekly snapshot", () => {
    const s = fixture(),
      previousWeek = structuredClone(s.weeks[0]);
    s.tasks.forEach((t, i) => {
      t.priority = i >= 3 ? 3 : 1;
    });
    s.tasks[6].enabled = false;
    ensurePlans(s, "2026-10-12");
    const nextMonday = new Date("2026-10-12T12:00:00Z");
    for (const o of s.weeks[1].required)
      complete(s, o.taskId, "required", o.id, nextMonday);
    const offered = extraOptions(s, "2026-10-12")[0],
      xp = totalXp(s),
      cash = balance(s);
    expect(previousWeek.required.map((o) => o.taskId)).toContain(offered.id);
    complete(s, offered.id, "extra", undefined, nextMonday);
    expect(s.completions.at(-1)).toMatchObject({
      type: "extra",
      xp: 0,
      nextDue: "2026-10-19",
    });
    expect(totalXp(s)).toBe(xp);
    expect(balance(s)).toBe(cash);
    expect(s.weeks[0]).toEqual(previousWeek);
    expect(
      s.completions.some((c) =>
        previousWeek.required.some((o) => o.id === c.occurrenceId),
      ),
    ).toBe(false);
  });
  it("requires completed normal plan", () => {
    const s = fixture(),
      t = s.tasks[4];
    expect(() => complete(s, t.id, "extra", undefined, now)).toThrow();
  });
  it("two extras update history and recurrence but no DA, money or weekly completion", () => {
    const s = fixture();
    finish(s);
    const xp = totalXp(s),
      cash = balance(s),
      count = completedIds(s).size;
    for (let i = 0; i < 2; i++) {
      const t = extraOptions(s, day)[0];
      complete(s, t.id, "extra", undefined, now);
      expect(s.tasks.find((x) => x.id === t.id)!.nextDue).toBe("2026-10-12");
    }
    expect(totalXp(s)).toBe(xp);
    expect(balance(s)).toBe(cash);
    expect(completedIds(s).size).toBe(count);
    expect(() =>
      complete(s, extraOptions(s, day)[0].id, "extra", undefined, now),
    ).toThrow("Na dnes stačí");
  });
  it("replacement does not bypass limits", () => {
    const s = fixture();
    finish(s);
    const choices = extraOptions(s, day);
    complete(s, choices[1].id, "extra", undefined, now);
    complete(s, choices[2].id, "extra", undefined, now);
    expect(() => complete(s, choices[0].id, "extra", undefined, now)).toThrow();
  });
  it("rejects extras above five minutes", () => {
    const s = fixture();
    finish(s);
    const t = makeTask(s, { duration: 6 });
    s.tasks.push(t);
    expect(() => complete(s, t.id, "extra", undefined, now)).toThrow();
  });
});
describe("household improvements and laundry", () => {
  it("deterministic solutions are safe for technical repairs", () => {
    const result = propose({
      title: "Opraviť elektrické rozvody",
      category: "Opraviť",
    });
    expect(result.solution).toContain("odborníka");
    expect(result.titles).toHaveLength(3);
  });
  it("Mega quest awards 500 DA once per month and can be undone", () => {
    const s = fixture();
    s.problems.push({
      id: "p",
      householdId: s.households[0].id,
      roomId: s.rooms[0].id,
      title: "V skrinke pri vchode je chaos.",
      description: "",
      category: "Zorganizovať",
      priority: 2,
      status: "Nové",
      budgetCents: 0,
      notes: "",
      solution: "",
      steps: [],
      photos: [],
      createdAt: now.toISOString(),
    });
    createMega(s, "p", day);
    expect(() => createMega(s, "p", day)).toThrow();
    s.megas[0].steps.forEach((st) => (st.done = true));
    reconcile(s);
    reconcile(s);
    expect(totalXp(s)).toBe(500);
    expect(s.problems[0].status).toBe("Vyriešené");
    s.megas[0].steps[0].done = false;
    reconcile(s);
    expect(totalXp(s)).toBe(0);
  });
  it("washer creates one timed hang follow-up without dryer", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    s.tasks.find((t) => t.id === o.taskId)!.workflow = "wash";
    complete(s, o.taskId, "required", o.id, now, 90);
    complete(s, o.taskId, "required", o.id, now, 90);
    const children = s.tasks.filter((t) => t.parentCompletionId);
    expect(children).toHaveLength(1);
    expect(children[0].title).toContain("Vyvesiť");
    expect(children[0].eventAt).toBe("2026-10-05T13:30:00.000Z");
    expect(() =>
      complete(s, children[0].id, "manual", undefined, now),
    ).toThrow();
  });
  it("dryer follow-up only when configured", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    s.objects.push({ ...s.objects[0], id: uid(), category: "dryer" });
    s.tasks.find((t) => t.id === o.taskId)!.workflow = "wash";
    complete(s, o.taskId, "required", o.id, now);
    expect(s.tasks.at(-1)!.title).toContain("sušičky");
  });
  it("undo removes unfinished follow-up", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    s.tasks.find((t) => t.id === o.taskId)!.workflow = "wash";
    complete(s, o.taskId, "required", o.id, now);
    undo(s, s.completions[0].id);
    expect(s.tasks.some((t) => t.parentCompletionId)).toBe(false);
  });
});
describe("backup validation", () => {
  it("round-trips all household records and accounting", () => {
    const s = fixture();
    finish(s);
    redeem(s, 235, "Čaj");
    expect(importBackup(exportBackup(s)).data).toEqual(s);
  });
  it.each(["bad", "{}", '{"format":"other","version":1}'])(
    "rejects malformed %s",
    (json) => expect(() => importBackup(json)).toThrow(),
  );
  it("unsupported version is explicit", () => {
    const b = JSON.parse(exportBackup(fixture()));
    b.version = 8;
    expect(() => importBackup(JSON.stringify(b))).toThrow("verzia");
  });
  it("rejects broken room/object relations and foreign households", () => {
    const s = fixture();
    s.tasks[0].roomId = "missing";
    expect(() => validateState(s)).toThrow();
    const second = fixture();
    second.rooms[0].householdId = "someone-else";
    expect(() => validateState(second)).toThrow();
  });
  it("rejects duplicate occurrences and altered DA accounting", () => {
    const s = fixture();
    finish(s);
    s.completions[0].xp = 999;
    expect(() => validateState(s)).toThrow();
    const dup = fixture();
    dup.dailyPlans[0].occurrences.push(dup.dailyPlans[0].occurrences[0]);
    expect(() => validateState(dup)).toThrow();
  });
});

describe("accounting and plan boundary regressions", () => {
  it("cannot use one occurrence to complete a different task", () => {
    const s = fixture(),
      o = s.weeks[0].required[0];
    expect(() => complete(s, s.tasks[4].id, "required", o.id, now)).toThrow();
  });
  it("overdue daily occurrences cannot award twice for same action in one day", () => {
    const s = fixture(false);
    s.settings[0].restDays = [];
    s.tasks = [makeTask(s, { recurrence: r() })];
    ensurePlans(s, day);
    const [monday, tuesday] = s.weeks[0].required;
    const date = new Date("2026-10-06T12:00Z");
    complete(s, monday.taskId, "required", monday.id, date);
    expect(() =>
      complete(s, tuesday.taskId, "required", tuesday.id, date),
    ).toThrow("dnes hotovú");
    expect(currentTasks(s, "2026-10-06")).toEqual([]);
  });
  it("old weekly snapshots do not become an intimidating daily backlog", () => {
    const s = fixture();
    ensurePlans(s, "2026-10-12");
    expect(
      currentTasks(s, "2026-10-12").every((o) => o.date >= "2026-10-12"),
    ).toBe(true);
    expect(s.weeks[0].required).toHaveLength(3);
  });
  it("a skipped normal plan cannot unlock extra mode", () => {
    const s = fixture();
    s.dailyPlans[0].occurrences.forEach((o) => (o.status = "skipped"));
    expect(() => complete(s, s.tasks[4].id, "extra", undefined, now)).toThrow(
      "Najprv",
    );
  });
  it("rest-aware streak uses snapshot after preference edits", () => {
    const s = fixture();
    finish(s);
    s.settings[0].restDays = [];
    expect(streak(s, "2026-10-07")).toBe(1);
  });
  it("unsafe object edits exclude existing generated tasks", () => {
    const s = fixture();
    s.tasks[0].objectId = s.objects[0].id;
    s.objects[0].accessibility = "unsafe";
    expect(
      pickTasks(s, day, s.tasks, 30).some((t) => t.id === s.tasks[0].id),
    ).toBe(false);
    expect(() =>
      complete(s, s.tasks[0].id, "required", s.weeks[0].required[0].id, now),
    ).toThrow("odborníka");
  });
});
