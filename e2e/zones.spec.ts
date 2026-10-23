import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seed, nav } from "./helpers";
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

function openHome(ready: boolean) {
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
      id: "floor",
      roomId: living.id,
      title: "Odložiť veci z podlahy",
      tier: 1,
      duration: 3,
      ...daily,
    }),
    makeTask(s, {
      id: "dishes",
      roomId: "room-kitchen",
      title: "Uprať riad z drezu",
      tier: 1,
      duration: 3,
      ...daily,
    }),
    makeTask(s, {
      id: "wipe",
      roomId: "room-kitchen",
      title: "Utrieť jednu batériu",
      tier: 2,
      duration: 5,
    }),
  );
  for (let offset = 1; offset <= 4; offset++) {
    const when = shiftDay(day, -offset);
    did(s, "dishes", when);
    if (ready) did(s, "floor", when);
  }
  return s;
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

test("a messy living room keeps the open space on Základ", async ({
  page,
}, info) => {
  await seed(page, openHome(false));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Utrieť jednu batériu")).toHaveCount(0);
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  const overview = page.getByRole("region", { name: "Prehľad úrovní" });
  await expect(
    overview.getByRole("heading", { name: "Prízemie – otvorený priestor" }),
  ).toBeVisible();
  await expect(overview.getByText("Úroveň: Základ")).toBeVisible();
  await expect(overview.getByText("Základ 0/7 dní").first()).toBeVisible();
  await expect(
    overview.getByText(/Obývačka má základ menej ako 4 dni/),
  ).toBeVisible();
  await expect(overview.getByText("dnes čaká").first()).toBeVisible();
  await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-zone-locked.png",
      fullPage: false,
    });
  await axe(page);

  await page.getByRole("button", { name: /Obývačka.*malých úloh/ }).click();
  await page.getByRole("button", { name: "Upraviť" }).first().click();
  const dialog = page.getByRole("dialog");
  const mark = dialog.getByRole("checkbox", {
    name: "Spojený priestor (otvorená kuchyňa, obývačka…)",
  });
  await expect(mark).toBeChecked();
  await mark.scrollIntoViewIfNeeded();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/zone-setup.png",
      fullPage: false,
    });
  await axe(page);
});

test("the open space shows Čisté only after every room has the základ", async ({
  page,
}, info) => {
  await seed(page, openHome(true));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Utrieť jednu batériu")).toHaveCount(0);
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  const overview = page.getByRole("region", { name: "Prehľad úrovní" });
  await expect(overview.getByText("Úroveň: Čisté")).toBeVisible();
  await expect(overview.getByText("Základ 4/7 dní").first()).toBeVisible();
  await expect(
    overview.getByText("Dnes ešte základ. Potom sa môže ukázať ďalšia úroveň."),
  ).toBeVisible();
  await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-zone-unlocked.png",
      fullPage: false,
    });
  await axe(page);

  await nav(page, "Domov");
  await page.getByRole("button", { name: "Základ máme" }).click();
  await expect(page.getByText("Utrieť jednu batériu")).toBeVisible();
  await expect(page.getByText("Odložiť veci z podlahy")).toHaveCount(0);
  await expect(page.getByText("Uprať riad z drezu")).toHaveCount(0);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/zone-unlocked-home.png",
      fullPage: false,
    });
});
