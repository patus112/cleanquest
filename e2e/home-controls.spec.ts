import { test, expect } from "@playwright/test";
import { seed, nav, read } from "./helpers";
import { day, fixture, makeTask, now } from "../tests/fixture";
import { ensurePlans } from "../src/domain/scheduler";

function home() {
  const s = fixture(false);
  // The shared fixture is a living room. This card is a kitchen basic, so the
  // screenshot room has to be a kitchen too.
  const kitchen = s.rooms[0];
  kitchen.name = "Kuchyňa";
  kitchen.category = "kitchen";
  s.settings[0].dailyBudget = 15;
  s.tasks = [
    makeTask(s, {
      id: "dishes",
      title: "Uprať riad z drezu",
      tier: 1,
      priority: 3,
      duration: 5,
    }),
    makeTask(s, {
      id: "wipe",
      title: "Utrieť jednu batériu",
      tier: 2,
      priority: 2,
      duration: 5,
    }),
  ];
  ensurePlans(s, day, now.toISOString());
  return s;
}

test("hard day is one switch, levels stay readable, and minutes match", async ({
  page,
}, info) => {
  await seed(page, home());
  await page.setViewportSize({ width: 390, height: 844 });
  const hardDay = page.getByRole("switch", { name: /Ťažký deň/ });
  const levels = page.getByRole("list", { name: "Úrovne upratovania" });
  await expect(hardDay).toHaveAttribute("aria-checked", "false");
  await expect(hardDay).toContainText("nie");
  await expect(levels.getByText("Základ")).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("button", { name: "Základ máme" })).toBeVisible();
  await expect(page.locator(".room-chip")).toHaveText("Kuchyňa");
  await expect(page.getByText("15 min denne")).toBeVisible();
  await expect(page.getByLabel("Dnešný časový blok")).toHaveValue("15");
  const reminder = page.getByRole("status", { name: "Malé pripomenutie" });
  if (await reminder.count()) {
    const box = await reminder.boundingBox();
    const card = await page.locator(".daily-card").boundingBox();
    expect(box && card).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(card!.width - 2);
  }
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-hard-day-off-viewport.png",
    });

  await hardDay.click();
  await expect(hardDay).toHaveAttribute("aria-checked", "true");
  await expect(hardDay).toContainText("áno");
  await expect(hardDay).toContainText("Ťažký deň");
  await expect(levels.getByText("Základ")).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "Základ máme" }).click();
  await expect(page.getByText("Základ máme. Ťažký deň sa nemení.")).toBeVisible();
  await expect(hardDay).toHaveAttribute("aria-checked", "true");
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-hard-day-on-viewport.png",
    });

  await page.getByLabel("Dnešný časový blok").selectOption("30");
  await expect(page.getByText("30 min denne")).toBeVisible();
  await expect(page.getByLabel("Dnešný časový blok")).toHaveValue("30");
  const rhythm = page.getByText("30 min denne");
  const select = page.getByLabel("Dnešný časový blok");
  await rhythm.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const tag = [...document.querySelectorAll(".daily-card .tag")].find((node) =>
      node.textContent?.includes("min denne"),
    );
    tag?.scrollIntoView({ block: "start" });
  });
  const tagBox = await rhythm.boundingBox();
  const selectBox = await select.boundingBox();
  expect(tagBox && selectBox).toBeTruthy();
  expect(tagBox!.y).toBeGreaterThanOrEqual(0);
  expect(selectBox!.y + selectBox!.height).toBeLessThanOrEqual(844);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-minutes-viewport.png",
    });

  await nav(page, "Profil");
  await expect(page.getByLabel("Denný čas")).toHaveValue("30");
  await nav(page, "Úlohy");
  await expect(page.getByText("30 min · vlastným tempom")).toBeVisible();
  const state = await read(page);
  expect(state.settings[0].dailyBudget).toBe(30);
  expect(state.settings[0].rescue).toBe(true);
  expect(state.dailyPlans.find((plan) => plan.date === day)?.timeBudget).toBe(30);
});
