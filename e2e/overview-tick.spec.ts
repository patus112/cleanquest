import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seed, nav, read } from "./helpers";
import { day, fixture, makeTask, now } from "../tests/fixture";
import { shiftDay, weekStart } from "../src/domain/calendar";
import { snapshot } from "../src/domain/scheduler";
import { xpFor, type Completion, type State } from "../src/domain/model";
import { validateState } from "../src/persistence/validation";

const weekly = {
  recurrence: {
    unit: "week" as const,
    interval: 1,
    strategy: "completion" as const,
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

/** Hallway like Patus's: weekly and monthly basics, no daily reset, tier 3 present. */
function hallwayHome() {
  const s = fixture(false);
  s.tasks = [];
  s.settings[0].dailyBudget = 10;
  s.settings[0].energy = 3;
  s.settings[0].restDays = [];
  const hall = s.rooms[0];
  hall.name = "Vstupná chodba";
  hall.category = "hallway";
  s.rooms.push(
    {
      ...hall,
      id: "narrow",
      name: "Úzka chodba",
      order: 1,
    },
    {
      ...hall,
      id: "kitchen",
      name: "Kuchyňa",
      category: "kitchen",
      order: 2,
    },
  );
  const clutter = makeTask(s, {
    id: "clutter",
    roomId: hall.id,
    title: "Odložiť veľké veci, ktoré sú na očiach",
    tier: 1,
    duration: 5,
    ...weekly,
  });
  const floor = makeTask(s, {
    id: "floor",
    roomId: hall.id,
    title: "Odložiť veci z podlahy",
    tier: 1,
    duration: 3,
    ...weekly,
  });
  s.tasks.push(
    clutter,
    floor,
    makeTask(s, {
      id: "returning",
      roomId: hall.id,
      title: "Vrátiť päť vecí na miesto",
      tier: 1,
      duration: 3,
      recurrence: {
        unit: "month",
        interval: 1,
        strategy: "completion",
        anchor: day,
      },
    }),
    makeTask(s, {
      id: "wipe",
      roomId: hall.id,
      title: "Utrieť troje dvierka skrinky",
      tier: 2,
      duration: 3,
      ...weekly,
    }),
    makeTask(s, {
      id: "detail",
      roomId: hall.id,
      title: "Vytriediť jednu časť skrinky",
      tier: 3,
      duration: 5,
    }),
    makeTask(s, {
      id: "early",
      roomId: hall.id,
      title: "Zložiť jednu deku",
      tier: 1,
      duration: 2,
      nextDue: shiftDay(day, 9),
      ...weekly,
    }),
    makeTask(s, {
      id: "early-bin",
      roomId: hall.id,
      title: "Vyniesť jeden malý kôš",
      tier: 1,
      duration: 3,
      nextDue: shiftDay(day, 12),
    }),
    makeTask(s, {
      id: "narrow-floor",
      roomId: "narrow",
      title: "Pozbierať veci z podlahy",
      tier: 1,
      duration: 3,
      ...weekly,
    }),
    makeTask(s, {
      id: "narrow-detail",
      roomId: "narrow",
      title: "Vytriediť jednu časť skrinky",
      tier: 3,
      duration: 5,
    }),
    makeTask(s, {
      id: "dishes",
      roomId: "kitchen",
      title: "Uprať riad z drezu",
      tier: 1,
      duration: 5,
      recurrence: {
        unit: "day",
        interval: 1,
        strategy: "completion",
        anchor: day,
      },
    }),
    makeTask(s, {
      id: "load",
      roomId: "kitchen",
      title: "Naložiť riad do umývačky",
      tier: 1,
      duration: 3,
      recurrence: {
        unit: "day",
        interval: 1,
        strategy: "completion",
        anchor: day,
      },
    }),
  );
  const occurrence = snapshot(s, floor, day);
  const start = weekStart(day);
  const householdId = s.households[0].id;
  s.dailyPlans.push({
    id: `day:${householdId}:${day}`,
    householdId,
    date: day,
    occurrences: [occurrence],
    timeBudget: 10,
    lockedAt: now.toISOString(),
  });
  s.weeks.push({
    id: `week:${householdId}:${start}`,
    householdId,
    start,
    end: shiftDay(start, 6),
    required: [structuredClone(occurrence)],
    rewardCents: s.settings[0].weeklyCents,
    rewardEnabled: s.settings[0].monetary,
    restDays: [],
    lockedAt: now.toISOString(),
  });
  did(s, "dishes", day);
  did(s, "load", day);
  return validateState(s);
}

async function axe(page: import("@playwright/test").Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("every basic row can be ticked and a weekly hallway stays on Základ", async ({
  page,
}, info) => {
  await seed(page, hallwayHome());
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  const overview = page.getByRole("region", { name: "Prehľad úrovní" });
  const hall = overview.getByRole("list", { name: "Základ v Vstupná chodba" });
  await expect(overview.getByRole("heading", { name: "Vstupná chodba" })).toBeVisible();
  await expect(overview.getByText("Úroveň: Detaily")).toHaveCount(0);
  await expect(overview.getByText("Úroveň: Základ").first()).toBeVisible();
  await expect(overview.getByText("Základ 0/7 dní").first()).toBeVisible();
  const clutter = hall.getByRole("button", {
    name: "Označiť ako hotové: Odložiť veľké veci, ktoré sú na očiach",
  });
  const box = await clutter.boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-levels-390.png",
      fullPage: false,
    });

  await hall
    .getByRole("button", { name: "Označiť ako hotové: Zložiť jednu deku" })
    .click();
  await expect(page.getByText("Hotovo. Tento základ sa počíta.")).toBeVisible();
  await expect(
    hall.locator("li").filter({ hasText: "Zložiť jednu deku" }),
  ).toContainText("hotové");

  await hall
    .getByRole("button", { name: "Označiť ako hotové: Vyniesť jeden malý kôš" })
    .click();
  await expect(
    hall.getByRole("alert"),
  ).toContainText("odmeňované úlohy");
  await expect(hall.getByText("dnes netreba").first()).toBeVisible();

  await clutter.click();
  await expect(page.getByText("Hotovo. Tento základ sa počíta.")).toBeVisible();
  const clutterRow = hall.locator("li").filter({
    hasText: "Odložiť veľké veci, ktoré sú na očiach",
  });
  await expect(clutterRow).toContainText("hotové");
  await expect(overview.getByText("Úroveň: Detaily")).toHaveCount(0);
  await expect(overview.getByText("Základ 1/7 dní").first()).toBeVisible();

  await hall
    .getByRole("button", { name: "Označiť ako hotové: Odložiť veci z podlahy" })
    .click();
  await expect(
    hall.locator("li").filter({ hasText: "Odložiť veci z podlahy" }),
  ).toContainText("hotové");

  const stored = await read(page);
  expect(
    stored.completions.find((item) => item.taskId === "clutter" && !item.undone)
      ?.type,
  ).toBe("required");
  expect(
    stored.completions.find((item) => item.taskId === "early" && !item.undone)
      ?.type,
  ).toBe("manual");
  expect(
    stored.completions.find((item) => item.taskId === "floor" && !item.undone)
      ?.type,
  ).toBe("required");
  expect(
    stored.completions.some((item) => item.taskId === "early-bin" && !item.undone),
  ).toBe(false);

  await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-tick-390.png",
      fullPage: false,
    });
  await axe(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-levels-desktop.png",
      fullPage: false,
    });

  await clutterRow
    .getByRole("button", { name: "Vrátiť: Odložiť veľké veci, ktoré sú na očiach" })
    .click();
  await expect(page.getByText("Vrátené. Tento základ znova čaká.")).toBeVisible();
  await expect(clutterRow).toContainText("dnes čaká");
});
