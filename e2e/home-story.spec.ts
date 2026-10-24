import { expect, test } from "@playwright/test";
import { complete } from "../src/domain/commands";
import { homeStory } from "../src/domain/progress";
import { dailySession } from "../src/domain/scheduler";
import { day, fixture, now } from "../tests/fixture";
import { seed } from "./helpers";

test("Domov mid-day and a met goal tell the same story", async ({
  page,
}, info) => {
  const mid = fixture();
  const first = dailySession(mid, day)[0];
  complete(mid, first.taskId, "required", first.id, now);
  expect(homeStory(mid, now).goalMet).toBe(false);
  await seed(page, mid);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".ring")).toContainText("minút");
  await expect(page.locator(".ring")).toContainText("/10");
  await expect(
    page.getByRole("heading", { name: "Kúsok po kúsku." }),
  ).toBeVisible();
  await expect(page.locator(".next-card").getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.getByText("malých krokov")).toHaveCount(0);
  await expect(page.getByText(/zostáva \d+/)).toHaveCount(0);
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-mid-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-mid-desktop.png",
      fullPage: false,
    });
  }

  const met = fixture();
  met.settings[0].dailyBudget = 30;
  const plan = met.dailyPlans.find((item) => item.date === day)!;
  plan.timeBudget = 30;
  const sample = plan.occurrences[0];
  plan.occurrences.push(
    {
      ...sample,
      id: "fill-block",
      taskId: "fill-block",
      title: "Uložiť deku na miesto",
      duration: 21,
      xp: 50,
    },
    {
      ...sample,
      id: "later-step",
      taskId: "later-step",
      title: "Navrch ešte jedna vec",
      duration: 5,
      xp: 20,
    },
  );
  for (let index = 0; index < 8 && !homeStory(met, now).goalMet; index++) {
    const next = dailySession(met, day)[0];
    if (!next) break;
    complete(met, next.taskId, "required", next.id, now);
  }
  expect(homeStory(met, now)).toMatchObject({
    goalMet: true,
    ring: null,
    usedMinutes: 30,
    goalMinutes: 30,
  });
  await seed(page, met);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Dnešný cieľ splnený" }).first(),
  ).toBeVisible();
  await expect(page.locator(".ring")).toContainText("cieľ splnený");
  await expect(page.getByText("malých krokov")).toHaveCount(0);
  await expect(page.getByText(/zostáva \d+/)).toHaveCount(0);
  await expect(page.locator(".ring")).not.toContainText("/13");
  await expect(page.getByText(/1 deň s denným cieľom/)).toBeVisible();
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-goal-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-goal-desktop.png",
      fullPage: false,
    });
  }
});
