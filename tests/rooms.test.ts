import { describe, expect, it } from "vitest";
import { fixture, day } from "./fixture";
import {
  saveRoom,
  moveObject,
  saveObject,
  saveRoomLayout,
} from "../src/domain/rooms";
import { generateTasks } from "../src/data/templates";
import { pickTasks, snapshot } from "../src/domain/scheduler";
import {
  exportBackup,
  importBackup,
  validateState,
} from "../src/persistence/validation";
import { recurrenceLabel } from "../src/domain/calendar";
import { ensurePlans } from "../src/domain/scheduler";
import { complete, undo } from "../src/domain/commands";
import { now } from "./fixture";

describe("detailed rooms and visual task references", () => {
  it("creates relevant curtains and blinds once without regenerating locked plans", () => {
    const s = fixture(),
      before = structuredClone(s.weeks),
      room = { ...s.rooms[0], curtains: true, blinds: true };
    saveRoom(s, room);
    s.tasks.push(...generateTasks(s));
    saveRoom(s, room);
    expect(generateTasks(s)).toEqual([]);
    expect(s.objects.filter((o) => o.category === "curtain")).toHaveLength(1);
    expect(
      s.tasks.filter((t) => t.templateId?.startsWith("blind-")),
    ).toHaveLength(4);
    expect(s.weeks).toEqual(before);
  });
  it("a window area never invents glass panels or window tasks", () => {
    const s = fixture();
    saveRoom(s, { ...s.rooms[0], windowArea: 14 });
    expect(s.objects.some((o) => o.category === "glass")).toBe(false);
    expect(
      generateTasks(s).some((t) => t.templateId?.startsWith("glass")),
    ).toBe(false);
  });
  it("a configured carpet receives small tasks without assuming a dining table", () => {
    const s = fixture(false);
    saveRoom(s, {
      ...s.rooms[0],
      flooring: "laminate",
      floorSurfaces: [{ material: "carpet", area: 3.5 }],
    });
    const generated = generateTasks(s);
    expect(s.objects.filter((o) => o.category === "carpet")).toHaveLength(1);
    expect(generated.some((t) => t.templateId === "carpet-1")).toBe(true);
    expect(generated.some((t) => t.templateId === "carpet-5")).toBe(false);
    saveRoom(s, { ...s.rooms[0] });
    expect(s.objects.filter((o) => o.category === "carpet")).toHaveLength(1);
  });
  it("absent blinds pause their library tasks and cannot be generated or scheduled", () => {
    const s = fixture(false);
    saveRoom(s, { ...s.rooms[0], blinds: true });
    s.tasks.push(...generateTasks(s));
    saveRoom(s, { ...s.rooms[0], blinds: false });
    const blind = s.objects.find((o) => o.category === "blind")!;
    expect(
      s.tasks.filter((t) => t.objectId === blind.id).every((t) => !t.enabled),
    ).toBe(true);
    expect(generateTasks(s).some((t) => t.objectId === blind.id)).toBe(false);
    s.tasks.find((t) => t.objectId === blind.id)!.enabled = true;
    expect(
      pickTasks(s, day, s.tasks, 30).some((t) => t.objectId === blind.id),
    ).toBe(false);
  });
  it("preserves original target in a plan after an object association changes", () => {
    const s = fixture(false),
      task = s.tasks[0];
    task.objectId = s.objects[0].id;
    const o = snapshot(s, task, day);
    delete task.objectId;
    expect(o.objectId).toBe(s.objects[0].id);
    expect(o.objectName).toBe(s.objects[0].name);
  });
  it("version two backups keep mixed surfaces, dimensions, zero windows and positions", () => {
    const s = fixture();
    Object.assign(s.rooms[0], {
      flooring: "laminate",
      floorSurfaces: [{ material: "carpet", area: 3 }],
      width: 4.5,
      length: 5,
      windowArea: 0,
      curtains: false,
      blinds: true,
    });
    Object.assign(s.objects[0], { position: { x: 20, y: 80 }, area: 1.2 });
    const backup = exportBackup(s);
    expect(JSON.parse(backup).version).toBe(2);
    expect(importBackup(backup).data).toEqual(s);
  });
  it("version one backups remain importable with unknown room details", () => {
    const s = fixture(),
      value = JSON.parse(exportBackup(s));
    value.version = 1;
    expect(importBackup(JSON.stringify(value)).data).toEqual(s);
    expect(
      importBackup(JSON.stringify(value)).data.rooms[0].curtains,
    ).toBeUndefined();
  });
  it("rejects invalid position and room measurements before storing a backup", () => {
    const s = fixture();
    s.objects[0].position = { x: -2, y: 50 };
    expect(() => validateState(s)).toThrow();
    delete s.objects[0].position;
    s.rooms[0].windowArea = -1;
    expect(() => validateState(s)).toThrow();
  });
  it("cannot move a room to a foreign floor", () => {
    const s = fixture();
    expect(() => saveRoom(s, { ...s.rooms[0], floorId: "other-home" })).toThrow(
      "podlažie",
    );
  });
  it("shows actual interval and preferred weekday in Slovak", () => {
    const r = fixture().tasks[0].recurrence;
    expect(recurrenceLabel({ ...r, unit: "day", interval: 7 })).toBe(
      "Každých 7 dní",
    );
    expect(
      recurrenceLabel({
        ...r,
        unit: "week",
        strategy: "calendar",
        preferredDay: 1,
      }),
    ).toContain("pondelok");
    expect(recurrenceLabel({ ...r, unit: "once" })).toBe("Jednorazovo");
  });
});

describe("moving household inventory", () => {
  function configured() {
    const s = fixture(false),
      object = s.objects[0];
    s.rooms.push({
      ...s.rooms[0],
      id: "destination",
      name: "Pracovňa",
      order: 1,
    });
    s.tasks[0].objectId = object.id;
    s.tasks[1].objectId = object.id;
    object.position = { x: 20, y: 80 };
    s.problems.push({
      id: "problem",
      householdId: object.householdId,
      roomId: object.roomId,
      objectId: object.id,
      title: "Chaos v skrinke",
      description: "",
      category: "Zorganizovať",
      priority: 1,
      status: "Nové",
      budgetCents: 0,
      notes: "",
      createdAt: now.toISOString(),
      solution: "",
      steps: [],
      photos: [],
    });
    ensurePlans(s, day, now.toISOString());
    return s;
  }
  it("moves tasks, linked problems and unfinished plan locations without changing obligations or rewards", () => {
    const s = configured(),
      original = structuredClone(s.weeks[0]),
      object = s.objects[0],
      tasks = structuredClone(s.tasks),
      rewards = structuredClone(s.rewards);
    moveObject(s, object.id, "destination");
    expect(object.roomId).toBe("destination");
    expect(object.position).toBeUndefined();
    expect(s.problems[0].roomId).toBe("destination");
    expect(
      s.tasks
        .filter((t) => t.objectId === object.id)
        .every((t) => t.roomId === "destination"),
    ).toBe(true);
    expect(
      s.tasks.map((t) => ({
        ...t,
        roomId: tasks.find((x) => x.id === t.id)!.roomId,
      })),
    ).toEqual(tasks);
    expect(s.weeks[0].required.map((o) => o.id)).toEqual(
      original.required.map((o) => o.id),
    );
    expect(
      s.weeks[0].required
        .filter((o) => o.objectId === object.id)
        .every((o) => o.roomName === "Pracovňa"),
    ).toBe(true);
    expect(
      s.weeks[0].required.map((o) => [o.date, o.duration, o.xp, o.taskId]),
    ).toEqual(
      original.required.map((o) => [o.date, o.duration, o.xp, o.taskId]),
    );
    expect(s.rewards).toEqual(rewards);
    expect(validateState(s)).toEqual(s);
    const once = structuredClone(s);
    moveObject(s, object.id, "destination");
    expect(s).toEqual(once);
  });
  it("keeps completed history and original completed snapshot locations", () => {
    const s = configured(),
      occurrence = s.dailyPlans[0].occurrences.find(
        (o) => o.taskId === s.tasks[0].id,
      )!;
    complete(s, occurrence.taskId, "required", occurrence.id, now);
    const history = structuredClone(s.completions),
      original = structuredClone(occurrence);
    moveObject(s, s.objects[0].id, "destination");
    expect(s.completions).toEqual(history);
    expect(occurrence).toEqual(original);
    expect(s.weeks[0].required.find((o) => o.id === occurrence.id)).toEqual(
      original,
    );
    expect(validateState(s)).toEqual(s);
  });
  it("rejects missing or foreign destinations before changing anything", () => {
    const s = configured(),
      original = structuredClone(s);
    expect(() => moveObject(s, s.objects[0].id, "missing")).toThrow(
      "miestnosť",
    );
    expect(s).toEqual(original);
    s.rooms[1].householdId = "foreign-household";
    expect(() => moveObject(s, s.objects[0].id, "destination")).toThrow(
      "miestnosť",
    );
    expect(s.objects[0].roomId).toBe(original.objects[0].roomId);
  });
  it("undoing a completion after a move restores its plan in the object's current room", () => {
    const s = configured(),
      occurrence = s.dailyPlans[0].occurrences.find(
        (o) => o.taskId === s.tasks[0].id,
      )!;
    complete(s, occurrence.taskId, "required", occurrence.id, now);
    const completion = s.completions[0],
      originalRoomName = completion.roomName;
    moveObject(s, s.objects[0].id, "destination");
    undo(s, completion.id);
    expect(occurrence.roomId).toBe("destination");
    expect(completion.roomName).toBe(originalRoomName);
    expect(completion.undone).toBe(true);
    complete(s, occurrence.taskId, "required", occurrence.id, now);
    expect(s.completions.filter((c) => !c.undone)).toHaveLength(1);
    expect(s.completions.at(-1)!.roomName).toBe("Pracovňa");
    expect(validateState(s)).toEqual(s);
  });
  it("editing an object's room preserves linked task relationships", () => {
    const s = configured();
    saveObject(s, {
      ...s.objects[0],
      name: "Premiestnená skrinka",
      roomId: "destination",
      position: undefined,
    });
    expect(s.objects[0].name).toBe("Premiestnená skrinka");
    expect(s.tasks[0].roomId).toBe("destination");
    expect(validateState(s)).toEqual(s);
  });
  it("saves and resets positions without affecting scheduling or rewards", () => {
    const s = configured(),
      before = structuredClone(s);
    saveRoomLayout(s, s.rooms[0].id, { [s.objects[0].id]: { x: 65.5, y: 35 } });
    expect(s.objects[0].position).toEqual({ x: 65.5, y: 35 });
    expect(s.weeks).toEqual(before.weeks);
    expect(s.tasks).toEqual(before.tasks);
    expect(s.rewards).toEqual(before.rewards);
    expect(importBackup(exportBackup(s)).data).toEqual(s);
    saveRoomLayout(s, s.rooms[0].id, { [s.objects[0].id]: undefined });
    expect(s.objects[0].position).toBeUndefined();
  });
  it("rejects stale or invalid drafts before partially applying any positions", () => {
    const s = configured(),
      before = structuredClone(s);
    expect(() =>
      saveRoomLayout(s, s.rooms[0].id, {
        [s.objects[0].id]: { x: 45, y: 65 },
        stale: { x: 10, y: 10 },
      }),
    ).toThrow("medzičasom");
    expect(s).toEqual(before);
    expect(() =>
      saveRoomLayout(s, s.rooms[0].id, {
        [s.objects[0].id]: { x: 200, y: 50 },
      }),
    ).toThrow("vnútri");
    expect(s).toEqual(before);
  });
});
