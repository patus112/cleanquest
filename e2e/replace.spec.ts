import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seed, nav, read } from "./helpers";
import { day, fixture, makeTask } from "../tests/fixture";
import { shiftDay } from "../src/domain/calendar";
import { xpFor, type Completion, type State } from "../src/domain/model";

const daily = {
  recurrence: {
    unit: "day" as const,
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

function rescueHome() {
  const s = fixture(false);
  s.tasks = [];
  s.settings[0].dailyBudget = 15;
  s.settings[0].rescue = true;
  s.tasks.push(
    makeTask(s, {
      id: "short",
      title: "Očistiť WC misu kefou",
      tier: 1,
      duration: 2,
    }),
    makeTask(s, {
      id: "spare",
      title: "Odložiť veci z podlahy",
      tier: 1,
      duration: 5,
      nextDue: shiftDay(day, 30),
    }),
    makeTask(s, {
      id: "wipe",
      title: "Utrieť jednu batériu",
      tier: 2,
      duration: 2,
    }),
  );
  return s;
}

function zoneHome() {
  const s = fixture(false);
  s.tasks = [];
  s.settings[0].dailyBudget = 15;
  const living = s.rooms[0];
  living.openPlan = true;
  s.rooms.push({
    ...living,
    id: "room-kitchen",
    name: "Kuchyňa",
    category: "kitchen",
    order: 1,
    openPlan: true,
  });
  s.tasks.push(
    makeTask(s, {
      id: "dishes",
      roomId: "room-kitchen",
      title: "Uprať riad z drezu",
      tier: 1,
      duration: 2,
      ...daily,
    }),
    makeTask(s, {
      id: "floor",
      roomId: living.id,
      title: "Odložiť veci z podlahy",
      tier: 1,
      duration: 3,
      ...daily,
    }),
    makeTask(s, {
      id: "spare",
      roomId: "room-kitchen",
      title: "Vyniesť jeden malý kôš",
      tier: 1,
      duration: 5,
      nextDue: shiftDay(day, 30),
    }),
    makeTask(s, {
      id: "later",
      roomId: living.id,
      title: "Zložiť jednu deku",
      tier: 1,
      duration: 3,
      nextDue: shiftDay(day, 40),
    }),
    makeTask(s, {
      id: "wipe",
      roomId: "room-kitchen",
      title: "Utrieť jednu batériu",
      tier: 2,
      duration: 2,
      ...daily,
    }),
  );
  for (let offset = 1; offset <= 4; offset++)
    did(s, "dishes", shiftDay(day, -offset));
  return s;
}

test("Nahradiť swaps a basic for another basic while Ťažký deň is on", async ({
  page,
}, info) => {
  await seed(page, rescueHome());
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("switch", { name: /Ťažký deň/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await nav(page, "Úlohy");
  await expect(
    page.getByRole("heading", { name: "Očistiť WC misu kefou" }),
  ).toBeVisible();
  await expect(page.getByText("Utrieť jednu batériu")).toHaveCount(0);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/replace-before.png",
      fullPage: false,
    });

  await page
    .getByRole("button", { name: "Možnosti: Očistiť WC misu kefou" })
    .click();
  await page.getByRole("menuitem", { name: "Nahradiť" }).click();
  await expect(page.getByText("Úloha bola nahradená.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Odložiť veci z podlahy" }),
  ).toBeVisible();
  await expect(page.getByText("Očistiť WC misu kefou")).toHaveCount(0);
  await expect(page.getByText("Utrieť jednu batériu")).toHaveCount(0);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/replace-after.png",
      fullPage: false,
    });

  await page
    .getByRole("button", { name: "Dokončiť: Odložiť veci z podlahy" })
    .click();
  await expect(
    page.getByRole("button", { name: "Možnosti: Odložiť veci z podlahy" }),
  ).toHaveCount(0);
});

test("an open-plan zone replaces with a basic, and the overview can tick one", async ({
  page,
}, info) => {
  await seed(page, zoneHome());
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Úlohy");
  await page
    .getByRole("button", { name: "Možnosti: Uprať riad z drezu" })
    .click();
  await page.getByRole("menuitem", { name: "Nahradiť" }).click();
  await expect(page.getByText("Úloha bola nahradená.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Zložiť jednu deku" }),
  ).toBeVisible();
  await expect(page.getByText("Uprať riad z drezu")).toHaveCount(0);
  await expect(page.getByText("Utrieť jednu batériu")).toHaveCount(0);
  const replaced = await read(page);
  const today = replaced.dailyPlans.find((plan) => plan.date === day);
  expect(today?.occurrences.some((item) => item.taskId === "wipe")).toBe(false);
  expect(today?.occurrences.some((item) => item.taskId === "later")).toBe(true);

  await page.getByRole("tab", { name: "Miestnosti" }).click();
  const overview = page.getByRole("region", { name: "Prehľad úrovní" });
  await expect(overview.getByText("Základ 0/7 dní").first()).toBeVisible();
  const floor = overview.getByRole("button", {
    name: "Označiť ako hotové: Odložiť veci z podlahy",
  });
  await floor.scrollIntoViewIfNeeded();
  await floor.click();
  await expect(page.getByText("Hotovo. Tento základ sa počíta.")).toBeVisible();
  await expect(overview.getByText("hotové").first()).toBeVisible();
  await expect(overview.getByText("Základ 0/7 dní")).toHaveCount(0);
  await expect(overview.getByText("Základ 1/7 dní").first()).toBeVisible();
  if (info.project.name === "mobile-chromium") {
    await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-basic-done.png",
      fullPage: false,
    });
  }
  await overview.getByRole("button", { name: "Vrátiť: Odložiť veci z podlahy" }).click();
  await expect(
    overview.getByRole("button", {
      name: "Označiť ako hotové: Odložiť veci z podlahy",
    }),
  ).toBeVisible();

  const early = overview.getByRole("button", {
    name: "Označiť ako hotové: Vyniesť jeden malý kôš",
  });
  await early.scrollIntoViewIfNeeded();
  await early.click();
  await expect(
    overview.getByRole("button", { name: "Vrátiť: Vyniesť jeden malý kôš" }),
  ).toBeVisible();
  expect(
    (await read(page)).completions.find(
      (item) => item.taskId === "spare" && !item.undone,
    )?.type,
  ).toBe("manual");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
