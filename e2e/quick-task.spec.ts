import { test, expect } from "@playwright/test";
import { seed, read, nav } from "./helpers";

test("quick task can be started now or saved as already done", async ({
  page,
}, info) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Rýchla úloha" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Rýchla úloha" }),
  ).toBeVisible();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/quick-task-dialog.png",
      fullPage: true,
    });
  await dialog.getByLabel("Názov").fill("Zložiť deku z pohovky");
  await dialog.getByLabel("Trvanie (minúty)").fill("5");
  await dialog.getByRole("button", { name: "Idem to spraviť teraz" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Zložiť deku z pohovky" }),
  ).toBeVisible();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/quick-task-focus.png",
      fullPage: true,
    });
  await dialog.getByRole("button", { name: "Mám hotovo" }).click();
  await expect(
    page.getByRole("heading", { name: "Malý krok. Hotovo." }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Na dnes si dám pauzu" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Rýchla úloha" }).click();
  const again = page.getByRole("dialog");
  await again.getByLabel("Názov").fill("Odniesť taniere");
  await again.getByRole("button", { name: "Už mám hotové" }).click();
  await expect(page.getByText("Zapísané. Malý krok sa počíta.")).toBeVisible();
  const state = await read(page);
  const started = state.tasks.find(
    (item) => item.title === "Zložiť deku z pohovky",
  );
  const done = state.tasks.find((item) => item.title === "Odniesť taniere");
  expect(started?.recurrence.unit).toBe("once");
  expect(done?.recurrence.unit).toBe("once");
  expect(
    state.completions.some(
      (item) => item.title === "Odniesť taniere" && item.xp > 0 && !item.undone,
    ),
  ).toBe(true);
  expect(
    state.weeks
      .flatMap((week) => week.required)
      .some((item) => item.taskId === done?.id || item.taskId === started?.id),
  ).toBe(false);

  await nav(page, "Úlohy");
  await expect(page.getByRole("heading", { name: "Dnešný plán" })).toBeVisible();
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "/opt/cursor/artifacts/plan-tier-note.png",
      fullPage: true,
    });
});
