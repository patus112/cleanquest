import { createHousehold } from "../src/data/household";
import { ensurePlans } from "../src/domain/scheduler";
import { type State, type Task, uid } from "../src/domain/model";
export const now = new Date("2026-10-05T12:00:00.000Z");
export const day = "2026-10-05";
export function makeTask(s: State, patch: Partial<Task> = {}): Task {
  return {
    id: uid(),
    householdId: s.households[0].id,
    roomId: s.rooms[0].id,
    title: "Utrieť jednu malú policu",
    instructions: "Iba jedna polica.",
    duration: 3,
    recurrence: {
      unit: "week",
      interval: 1,
      strategy: "completion",
      anchor: day,
    },
    priority: 2,
    energy: 1,
    supplies: [],
    enabled: true,
    nextDue: day,
    acceptedLong: false,
    ...patch,
  };
}
export function fixture(plans = true) {
  const s = createHousehold(
    {
      name: "Testovací domov",
      displayName: "Patricia",
      type: "apartment",
      area: 60,
      floors: 1,
      residents: 1,
      children: false,
      pets: false,
      template: false,
      rooms: ["living"],
      budget: 10,
      restDays: [0, 2, 3, 4, 5, 6],
      monetary: true,
      intensity: "balanced",
      specialNeeds: "",
    },
    now,
  );
  s.households[0].timezone = "Europe/Bratislava";
  s.tasks = Array.from({ length: 7 }, (_, i) =>
    makeTask(s, {
      id: `task-${i}`,
      title: `Utrieť malú policu ${i + 1}`,
      priority: i < 3 ? 3 : 1,
    }),
  );
  if (plans) ensurePlans(s, day, now.toISOString());
  return s;
}
