import { describe, expect, it } from "vitest";
import { complete, extraOptions } from "../src/domain/commands";
import { xpFor, type Completion } from "../src/domain/model";
import { levelOverview, taskTier } from "../src/domain/tiers";
import { totalXp } from "../src/domain/rewards";
import { day, fixture, makeTask, now } from "./fixture";

function fill(state: ReturnType<typeof fixture>) {
  const duration = state.settings[0].dailyBudget;
  const completion: Completion = {
    id: "full-block",
    householdId: state.households[0].id,
    taskId: "filled",
    occurrenceId: "manual:filled",
    title: "Dnešný blok",
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
  state.completions.push(completion);
}

describe("bonuses past the rewarded block", () => {
  it("keeps basics first and records each one with 0 DA", () => {
    const state = fixture();
    const room = state.rooms[0].id;
    state.tasks.push(
      makeTask(state, {
        id: "bonus-detail",
        roomId: room,
        title: "Utrieť lišty pri okne",
        duration: 8,
        tier: 2,
        nextDue: day,
      }),
      makeTask(state, {
        id: "bonus-basic",
        roomId: room,
        title: "Odložiť veci z podlahy",
        duration: 4,
        tier: 1,
        nextDue: day,
      }),
    );
    fill(state);
    const options = extraOptions(state, day);
    const tiers = options.map((task) => taskTier(task));
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(options[0] && taskTier(options[0])).toBe(1);
    expect(options.some((task) => task.id === "bonus-basic")).toBe(true);
    const basicAt = options.findIndex((task) => task.id === "bonus-basic");
    const detailAt = options.findIndex((task) => task.id === "bonus-detail");
    if (detailAt >= 0) expect(basicAt).toBeLessThan(detailAt);

    const xp = totalXp(state);
    for (let index = 0; index < 3; index++) {
      const next = extraOptions(state, day)[0];
      expect(next).toBeTruthy();
      complete(state, next.id, "extra", undefined, now);
    }
    const extras = state.completions.filter(
      (item) => item.type === "extra" && !item.undone,
    );
    expect(extras).toHaveLength(3);
    expect(extras.every((item) => item.xp === 0)).toBe(true);
    expect(totalXp(state)).toBe(xp);
    const basics = levelOverview(state, day)
      .flatMap((group) => group.rooms)
      .flatMap((item) => item.basics);
    expect(basics.find((item) => item.id === "bonus-basic")?.status).toBe(
      "done",
    );
    expect(
      levelOverview(state, day).find((group) =>
        group.rooms.some((item) => item.roomId === room),
      )?.tier1Days,
    ).toBeGreaterThan(0);
  });

  it("lists due rows before later rows and finished rows", () => {
    const state = fixture();
    const room = state.rooms[0].id;
    state.tasks.push(
      makeTask(state, {
        id: "row-done",
        roomId: room,
        title: "Zložiť jednu deku",
        tier: 1,
        nextDue: day,
      }),
      makeTask(state, {
        id: "row-later",
        roomId: room,
        title: "Vyniesť jeden malý kôš",
        tier: 1,
        nextDue: "2026-10-20",
      }),
      makeTask(state, {
        id: "row-wait",
        roomId: room,
        title: "Odložiť veci z podlahy",
        tier: 1,
        nextDue: day,
      }),
    );
    state.completions.push({
      id: "row-done-completion",
      householdId: state.households[0].id,
      taskId: "row-done",
      occurrenceId: "manual:row-done",
      title: "Zložiť jednu deku",
      roomName: state.rooms[0].name,
      duration: 3,
      completedAt: now.toISOString(),
      day,
      type: "manual",
      xp: 0,
      previousDue: day,
      nextDue: day,
      undone: false,
    });
    const rows = levelOverview(state, day)
      .flatMap((group) => group.rooms)
      .find((item) => item.roomId === room)!.basics;
    const ids = rows.map((item) => item.id);
    const rank = { waiting: 0, later: 1, done: 2 };
    expect(ids.indexOf("row-wait")).toBeLessThan(ids.indexOf("row-later"));
    expect(ids.indexOf("row-later")).toBeLessThan(ids.indexOf("row-done"));
    const ordered = rows.map((item) => rank[item.status]);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  });
});
