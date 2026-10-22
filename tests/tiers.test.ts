import { describe, expect, it } from "vitest";
import { fixture, day, makeTask, now } from "./fixture";
import { pickTasks, dailySession, ensurePlans, openTasks } from "../src/domain/scheduler";
import { applyDailyBudget, complete, markBasicsOk, setRescue } from "../src/domain/commands";
import { missingBasicTasks, templates } from "../src/data/templates";
import {
  cleaningProgress,
  taskTier,
  tierHint,
  TIER_UNLOCK_DAYS,
  TIER_WINDOW_DAYS,
  rescueHint,
} from "../src/domain/tiers";
import { shiftDay } from "../src/domain/calendar";
import { xpFor, type Completion, type State, type Task } from "../src/domain/model";
import { validateState } from "../src/persistence/validation";

function home() {
  const s = fixture(false);
  s.tasks = [];
  s.settings[0].energy = 3;
  s.settings[0].dailyBudget = 30;
  s.settings[0].restDays = [];
  const householdId = s.households[0].id;
  s.floors.push({
    id: "floor-up",
    householdId,
    name: "1. poschodie",
    order: 1,
  });
  s.rooms.push({
    ...s.rooms[0],
    id: "room-up",
    name: "Horná izba",
    floorId: "floor-up",
    order: 1,
  });
  return s;
}
function task(
  s: State,
  roomId: string,
  title: string,
  patch: Parameters<typeof makeTask>[1] = {},
) {
  const created = makeTask(s, {
    id: title,
    roomId,
    title,
    duration: 3,
    priority: 2,
    tier: taskTier({ title }),
    ...patch,
  });
  s.tasks.push(created);
  return created;
}
const often: Partial<Task> = {
  recurrence: {
    unit: "day",
    interval: 1,
    strategy: "completion",
    anchor: day,
  },
};
function did(s: State, taskId: string, when: string) {
  const source = s.tasks.find((item) => item.id === taskId)!;
  const completion: Completion = {
    id: `done-${taskId}-${when}`,
    householdId: s.households[0].id,
    taskId,
    occurrenceId: `manual:${taskId}@${when}`,
    title: source.title,
    roomName: "Miestnosť",
    duration: source.duration,
    completedAt: `${when}T12:00:00.000Z`,
    day: when,
    type: "manual",
    xp: xpFor(source.duration),
    previousDue: when,
    nextDue: when,
    undone: false,
  };
  s.completions.push(completion);
}

describe("cleaning tiers", () => {
  it("classifies sink details, dishes and ordinary wiping", () => {
    expect(
      templates.find((item) => item.title === "Očistiť zátku umývadla")?.tier,
    ).toBe(3);
    expect(
      templates.find((item) => item.title === "Vybrať viditeľné nečistoty zo sitka")
        ?.tier,
    ).toBe(3);
    expect(templates.find((item) => item.id === "basic-sink-dishes")?.tier).toBe(
      1,
    );
    expect(
      templates.find((item) => item.title === "Vyniesť jeden malý kôš")?.tier,
    ).toBe(1);
    expect(
      templates.find((item) => item.title === "Utrieť jednu batériu")?.tier,
    ).toBe(2);
    expect(TIER_WINDOW_DAYS).toBe(7);
    expect(TIER_UNLOCK_DAYS).toBe(4);
  });

  it("backfills sink dishes only onto a kitchen sink", () => {
    const s = fixture(false);
    s.tasks = [];
    const living = s.rooms[0];
    const kitchen = {
      ...living,
      id: "room-kitchen",
      name: "Kuchyňa",
      category: "kitchen" as const,
      order: 1,
    };
    const bath = {
      ...living,
      id: "room-bath",
      name: "Kúpeľňa",
      category: "bathroom" as const,
      order: 2,
    };
    s.rooms.push(kitchen, bath);
    for (const [id, roomId] of [
      ["sink-living", living.id],
      ["sink-kitchen", kitchen.id],
      ["sink-bath", bath.id],
    ] as const)
      s.objects.push({
        id,
        householdId: s.households[0].id,
        roomId,
        name: "Drez",
        category: "sink",
        quantity: 1,
        dimensions: "",
        surface: "",
        accessibility: "safe",
        notes: "",
      });
    const dishes = missingBasicTasks(s).filter(
      (task) => task.templateId === "basic-sink-dishes",
    );
    expect(dishes.map((task) => task.roomId)).toEqual(["room-kitchen"]);
    expect(dishes[0]?.objectId).toBe("sink-kitchen");
    expect(
      missingBasicTasks(s).some(
        (task) =>
          task.templateId === "basic-sink-dishes" && task.roomId !== kitchen.id,
      ),
    ).toBe(false);
  });

  it("offers tier 1 across rooms before details, ground floor breaking a tie", () => {
    const s = home();
    task(s, s.rooms[0].id, "Uprať riad z drezu", { priority: 2 });
    task(s, s.rooms[0].id, "Očistiť zátku umývadla", { priority: 3 });
    task(s, "room-up", "Rýchlo očistiť WC misu", { priority: 2 });
    task(s, "room-up", "Utrieť jednu batériu", { priority: 3 });
    const chosen = pickTasks(s, day, s.tasks, 30).map((item) => item.title);
    expect(chosen).toEqual([
      "Uprať riad z drezu",
      "Rýchlo očistiť WC misu",
    ]);
  });

  it("keeps other basics when one room's basic is still open", () => {
    const s = home();
    const dishes = task(s, s.rooms[0].id, "Uprať riad z drezu");
    task(s, s.rooms[0].id, "Očistiť zátku umývadla", { priority: 3 });
    task(s, "room-up", "Rýchlo očistiť WC misu");
    ensurePlans(s, day, now.toISOString());
    const dish = s.dailyPlans
      .flatMap((plan) => plan.occurrences)
      .find((item) => item.taskId === dishes.id)!;
    dish.deferredTo = shiftDay(day, 1);
    const titles = dailySession(s, day, 30).map((item) => item.title);
    expect(titles).toContain("Rýchlo očistiť WC misu");
    expect(titles).not.toContain("Očistiť zátku umývadla");
    expect(titles).not.toContain("Uprať riad z drezu");
  });

  it("unlocks the next tier from existing history and falls back without deleting it", () => {
    const s = home();
    const dishes = task(s, s.rooms[0].id, "Uprať riad z drezu", often);
    const plug = task(s, s.rooms[0].id, "Očistiť zátku umývadla", {
      priority: 3,
    });
    for (let offset = 1; offset <= 3; offset++) did(s, dishes.id, shiftDay(day, -offset));
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      false,
    );
    did(s, dishes.id, shiftDay(day, -4));
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      false,
    );
    did(s, dishes.id, day);
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      true,
    );
    const later = shiftDay(day, 8);
    expect(
      pickTasks(s, later, s.tasks, 30).some((item) => item.id === plug.id),
    ).toBe(false);
    expect(s.tasks.find((item) => item.id === plug.id)?.enabled).toBe(true);
    expect(s.completions.some((item) => item.taskId === dishes.id)).toBe(true);
    expect(tierHint(3, true)).toBe(
      "Základ ti ide už 3 dni z posledných 7. Pokojne pokračuj.",
    );
    expect(tierHint(4, true)).toBe(
      "Základ ti ide už 4 dni, pomaly pridáme ďalšie.",
    );
    expect(tierHint(0, true)).not.toMatch(/zlyh|málo|nestíh|hanba|musíš/i);
    expect(rescueHint).not.toMatch(/zlyh|hanba|musíš/i);
  });

  it("keeps details back when today makes only three basic days", () => {
    const s = home();
    const dishes = task(s, s.rooms[0].id, "Uprať riad z drezu", often);
    const plug = task(s, s.rooms[0].id, "Očistiť zátku umývadla");
    for (let offset = 1; offset <= 2; offset++)
      did(s, dishes.id, shiftDay(day, -offset));
    did(s, dishes.id, day);
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      false,
    );
  });

  it("lets a weekly reset open the room once today is handled", () => {
    const s = home();
    const floor = task(s, s.rooms[0].id, "Odložiť veci z podlahy");
    const wipe = task(s, s.rooms[0].id, "Utrieť jednu batériu");
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === wipe.id)).toBe(
      false,
    );
    did(s, floor.id, day);
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === wipe.id)).toBe(
      true,
    );
  });

  it("holds details until regular cleaning is regular too", () => {
    const s = home();
    const dishes = task(s, s.rooms[0].id, "Uprať riad z drezu", often);
    const wipe = task(s, s.rooms[0].id, "Utrieť jednu batériu", often);
    const plug = task(s, s.rooms[0].id, "Očistiť zátku umývadla", {
      priority: 3,
    });
    for (let offset = 1; offset <= 4; offset++)
      did(s, dishes.id, shiftDay(day, -offset));
    did(s, dishes.id, day);
    const chosen = () => pickTasks(s, day, s.tasks, 30).map((item) => item.id);
    expect(chosen()).toContain(wipe.id);
    expect(chosen()).not.toContain(plug.id);
    for (let offset = 1; offset <= 4; offset++)
      did(s, wipe.id, shiftDay(day, -offset));
    expect(chosen()).toContain(plug.id);
    const later = shiftDay(day, 8);
    const slipped = pickTasks(s, later, s.tasks, 30).map((item) => item.id);
    expect(slipped).not.toContain(wipe.id);
    expect(slipped).not.toContain(plug.id);
    expect(s.tasks.every((item) => item.enabled)).toBe(true);
  });

  it("lets an explicit OK open the same day only after the streak exists", () => {
    const s = home();
    const dishes = task(s, s.rooms[0].id, "Uprať riad z drezu", often);
    const plug = task(s, s.rooms[0].id, "Očistiť zátku umývadla");
    ensurePlans(s, day, now.toISOString());
    markBasicsOk(s, s.rooms[0].id, now);
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      false,
    );
    for (let offset = 1; offset <= 4; offset++)
      did(s, dishes.id, shiftDay(day, -offset));
    expect(pickTasks(s, day, s.tasks, 30).some((item) => item.id === plug.id)).toBe(
      true,
    );
  });

  it("rescue mode keeps only tier 1 and still prefers impact, then the lower floor", () => {
    const s = home();
    task(s, s.rooms[0].id, "Odložiť veci z podlahy", { priority: 2 });
    task(s, "room-up", "Rýchlo očistiť WC misu", { priority: 3 });
    task(s, s.rooms[0].id, "Očistiť zátku umývadla", { priority: 3 });
    for (let offset = 1; offset <= 4; offset++)
      did(s, "Odložiť veci z podlahy", shiftDay(day, -offset));
    did(s, "Odložiť veci z podlahy", day);
    setRescue(s, true, now);
    const rescued = pickTasks(s, day, s.tasks, 30, [], "", {
      rescue: true,
    }).map((item) => item.title);
    expect(rescued[0]).toBe("Rýchlo očistiť WC misu");
    expect(rescued).toContain("Odložiť veci z podlahy");
    expect(rescued).not.toContain("Očistiť zátku umývadla");
    s.tasks.find((item) => item.title === "Rýchlo očistiť WC misu")!.priority = 2;
    const tied = pickTasks(s, day, s.tasks, 30, [], "", { rescue: true }).map(
      (item) => item.title,
    );
    expect(tied[0]).toBe("Odložiť veci z podlahy");
    expect(tied).not.toContain("Očistiť zátku umývadla");
  });

  it("imports backups with and without the new optional fields", () => {
    const s = fixture();
    expect(() => validateState(structuredClone(s))).not.toThrow();
    s.settings[0].rescue = true;
    s.tasks[0].tier = 1;
    s.dailyPlans[0].basicsOk = [s.rooms[0].id];
    s.dailyPlans[0].occurrences[0].lead = true;
    const restored = validateState(JSON.parse(JSON.stringify(s)));
    expect(restored.settings[0].rescue).toBe(true);
    expect(restored.tasks[0].tier).toBe(1);
    expect(restored.dailyPlans[0].basicsOk).toEqual([s.rooms[0].id]);
    expect(restored.dailyPlans[0].occurrences[0].lead).toBe(true);
    delete s.tasks[0].tier;
    delete s.settings[0].rescue;
    delete s.dailyPlans[0].basicsOk;
    delete s.dailyPlans[0].occurrences[0].lead;
    expect(validateState(JSON.parse(JSON.stringify(s))).tasks[0].tier).toBeUndefined();
  });

  it("does not let a new basic crowd out tasks already in today's block", () => {
    const s = home();
    s.settings[0].dailyBudget = 10;
    s.rooms.push({
      ...s.rooms[0],
      id: "room-other",
      name: "Pracovňa",
      order: 2,
    });
    const shelves = [1, 2, 3].map((n) =>
      task(s, s.rooms[0].id, `Utrieť malú policu ${n}`, { priority: 2 }),
    );
    ensurePlans(s, day, now.toISOString());
    task(s, "room-other", "Odložiť veci z podlahy");
    const first = s.dailyPlans
      .find((plan) => plan.date === day)!
      .occurrences.find((item) => item.taskId === shelves[0].id)!;
    complete(s, shelves[0].id, "required", first.id, now);
    expect(dailySession(s, day, 10).map((item) => item.title)).toEqual([
      "Utrieť malú policu 2",
      "Utrieť malú policu 3",
    ]);
  });

  it("does not schedule a detail ahead of a basic inside a generated day", () => {
    const s = home();
    task(s, s.rooms[0].id, "Uprať riad z drezu", often);
    task(s, s.rooms[0].id, "Očistiť zátku umývadla", { priority: 3 });
    ensurePlans(s, day, now.toISOString());
    const today = s.dailyPlans.find((plan) => plan.date === day)!;
    expect(today.occurrences.map((item) => item.title)).toContain(
      "Uprať riad z drezu",
    );
    expect(today.occurrences.map((item) => item.title)).not.toContain(
      "Očistiť zátku umývadla",
    );
    complete(s, "Uprať riad z drezu", "required", today.occurrences[0].id, now);
    expect(
      s.dailyPlans
        .find((plan) => plan.date === day)!
        .occurrences.some((item) => item.title === "Očistiť zátku umývadla"),
    ).toBe(false);
  });

  it("lights the current cleaning level and keeps a hard day on Základ", () => {
    expect(cleaningProgress(false, 1).map((step) => step.state)).toEqual([
      "current",
      "later",
      "later",
    ]);
    expect(
      cleaningProgress(false, 2).map((step) => [step.name, step.state]),
    ).toEqual([
      ["Základ", "done"],
      ["Čisté", "current"],
      ["Detaily", "later"],
    ]);
    expect(cleaningProgress(false, 3).map((step) => step.state)).toEqual([
      "done",
      "done",
      "current",
    ]);
    expect(cleaningProgress(true, 3).map((step) => step.state)).toEqual([
      "current",
      "later",
      "later",
    ]);
  });

  it("Základ máme skips that room's basic and does not turn Ťažký deň off", () => {
    const s = home();
    task(s, s.rooms[0].id, "Uprať riad z drezu");
    task(s, "room-up", "Rýchlo očistiť WC misu");
    task(s, s.rooms[0].id, "Utrieť jednu batériu", often);
    ensurePlans(s, day, now.toISOString());
    setRescue(s, true, now);
    markBasicsOk(s, s.rooms[0].id, now);
    expect(s.settings[0].rescue).toBe(true);
    const titles = openTasks(s, day).map((item) => item.title);
    expect(titles).not.toContain("Uprať riad z drezu");
    expect(titles).toContain("Rýchlo očistiť WC misu");
    expect(titles).not.toContain("Utrieť jednu batériu");
  });

  it("uses the saved daily minutes for today onward and leaves yesterday", () => {
    const s = fixture();
    const past = shiftDay(day, -1);
    s.dailyPlans.push({
      ...s.dailyPlans[0],
      id: "past-plan",
      date: past,
      occurrences: [],
      timeBudget: 10,
    });
    const required = s.weeks[0].required.map((item) => item.id);
    applyDailyBudget(s, 30, now);
    expect(s.settings[0].dailyBudget).toBe(30);
    expect(s.dailyPlans.find((plan) => plan.date === day)?.timeBudget).toBe(30);
    expect(s.dailyPlans.find((plan) => plan.date === past)?.timeBudget).toBe(10);
    expect(s.weeks[0].required.map((item) => item.id)).toEqual(required);
  });
});
