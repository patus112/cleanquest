import { test, expect } from "@playwright/test";
import { seed, nav } from "./helpers";
import { day, fixture, makeTask } from "../tests/fixture";
import { shiftDay } from "../src/domain/calendar";
import { xpFor, type Completion } from "../src/domain/model";

function tierHome() {
  const s = fixture(false);
  s.settings[0].dailyBudget = 30;
  s.settings[0].energy = 3;
  s.tasks = [];
  const daily = {
    unit: "day" as const,
    interval: 1,
    strategy: "completion" as const,
    anchor: day,
  };
  const dishes = makeTask(s, {
    id: "dishes",
    title: "Uprať riad z drezu",
    duration: 5,
    priority: 3,
    tier: 1,
    recurrence: daily,
  });
  const wipe = makeTask(s, {
    id: "wipe",
    title: "Utrieť jednu batériu",
    duration: 5,
    priority: 2,
    tier: 2,
    recurrence: daily,
  });
  const plug = makeTask(s, {
    id: "plug",
    title: "Očistiť zátku umývadla",
    duration: 5,
    priority: 3,
    tier: 3,
  });
  s.tasks.push(dishes, wipe, plug);
  for (let offset = 1; offset <= 4; offset++) {
    const when = shiftDay(day, -offset);
    const completion: Completion = {
      id: `done-dishes-${when}`,
      householdId: s.households[0].id,
      taskId: dishes.id,
      occurrenceId: `manual:dishes@${when}`,
      title: dishes.title,
      roomName: s.rooms[0].name,
      duration: dishes.duration,
      completedAt: `${when}T12:00:00.000Z`,
      day: when,
      type: "manual",
      xp: xpFor(dishes.duration),
      previousDue: when,
      nextDue: when,
      undone: false,
    };
    s.completions.push(completion);
  }
  return s;
}

test("basics stay ahead of details until they are regular, and a hard day falls back", async ({
  page,
}, info) => {
  await seed(page, tierHome());
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Úlohy");
  await expect(page.getByRole("heading", { name: "Dnešný plán" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Uprať riad z drezu" }),
  ).toBeVisible();
  await expect(
    page.getByText("Základ ti ide už 4 dni, pomaly pridáme ďalšie."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Utrieť jednu batériu" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Očistiť zátku umývadla" }),
  ).toHaveCount(0);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/plan-tier-gating.png",
      fullPage: true,
    });

  await nav(page, "Domov");
  await page.getByRole("button", { name: "Už je to OK" }).click();
  await expect(
    page.getByText("V tejto miestnosti je základ v poriadku."),
  ).toBeVisible();
  await nav(page, "Úlohy");
  await expect(
    page.getByRole("heading", { name: "Utrieť jednu batériu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Očistiť zátku umývadla" }),
  ).toHaveCount(0);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/plan-tier-open.png",
      fullPage: true,
    });

  await nav(page, "Domov");
  await page.getByRole("button", { name: "Ťažký deň" }).click();
  await expect(
    page.getByRole("button", { name: "Záchranný režim" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ťažký deň. Dnes len základ, ostatné v pokoji počká."),
  ).toBeVisible();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/rescue-mode.png",
      fullPage: true,
    });
  await nav(page, "Úlohy");
  await expect(
    page.getByRole("heading", { name: "Uprať riad z drezu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Utrieť jednu batériu" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ťažký deň. Dnes len základ, ostatné v pokoji počká."),
  ).toBeVisible();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/rescue-plan.png",
      fullPage: true,
    });
});
