import { expect, test } from "@playwright/test";
import { ensurePlans } from "../src/domain/scheduler";
import { day, fixture, now } from "../tests/fixture";
import { seed } from "./helpers";

test("week days show task icons and the reminder sits below the main cards", async ({
  page,
}) => {
  const state = fixture(false);
  state.settings[0].restDays = [0];
  state.settings[0].dailyBudget = 15;
  for (const task of state.tasks)
    task.recurrence = { ...task.recurrence, unit: "day", interval: 1 };
  ensurePlans(state, day, now.toISOString());
  await seed(page, state);

  const reminder = page.getByRole("status", { name: "Malé pripomenutie" });
  const greeting = page.getByRole("heading", { name: "Ahoj, Patricia." });
  const daily = page.locator(".daily-card");
  const next = page.locator(".next-card");

  const belowCards = async () => {
    const boxes = await Promise.all(
      [reminder, greeting, daily, next].map((locator) => locator.boundingBox()),
    );
    const [reminderBox, greetingBox, dailyBox, nextBox] = boxes;
    expect(reminderBox && greetingBox && dailyBox && nextBox).toBeTruthy();
    expect(reminderBox!.y).toBeGreaterThan(greetingBox!.y + greetingBox!.height - 1);
    expect(reminderBox!.y).toBeGreaterThanOrEqual(dailyBox!.y + dailyBox!.height - 1);
    expect(reminderBox!.y).toBeGreaterThanOrEqual(nextBox!.y + nextBox!.height - 1);
  };

  await page.setViewportSize({ width: 390, height: 844 });
  const monday = page.locator(".week-strip > div").first();
  await expect(monday).toHaveClass(/today/);
  await expect(monday.locator(".day-task svg").first()).toBeVisible();
  await expect(monday).toHaveAttribute("aria-label", /Utrieť/);
  const tuesday = page.locator(".week-strip > div").nth(1);
  await expect(tuesday.locator(".day-task svg").first()).toBeVisible();
  await expect(page.locator(".week-strip > div").nth(6).locator(".day-task")).toHaveCount(0);
  await expect(reminder).toBeVisible();
  await belowCards();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".week-strip .day-task svg").first()).toBeVisible();
  await belowCards();
});
