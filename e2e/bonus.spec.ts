import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { complete, extraOptions } from "../src/domain/commands";
import { homeStory } from "../src/domain/progress";
import { taskTier } from "../src/domain/tiers";
import { day, fixture, makeTask, now } from "../tests/fixture";
import { nav, read, seed } from "./helpers";

test("a met goal offers a named bonus and records the next one", async ({
  page,
}, info) => {
  const state = fixture();
  state.tasks.push(
    makeTask(state, {
      id: "bonus-basic",
      title: "Odložiť veci z podlahy",
      tier: 1,
      duration: 3,
      nextDue: day,
    }),
    makeTask(state, {
      id: "bonus-next",
      title: "Zložiť jednu deku",
      tier: 1,
      duration: 4,
      nextDue: day,
    }),
  );
  for (const item of state.weeks[0].required)
    complete(state, item.taskId, "required", item.id, now);
  expect(homeStory(state, now).goalMet).toBe(true);
  const offered = extraOptions(state, day);
  expect(offered.length).toBeGreaterThan(1);
  expect(taskTier(offered[0])).toBeLessThanOrEqual(taskTier(offered[1]));
  const first = offered[0];
  await seed(page, state);
  await page.setViewportSize({ width: 390, height: 844 });
  const offer = page.locator(".bonus-offer");
  await expect(offer.getByRole("heading", { name: first.title })).toBeVisible();
  await expect(offer).toContainText("bez bodov");
  await expect(offer).toContainText(`${first.duration} min`);
  await expect(offer.getByRole("button", { name: "Hotovo" })).toBeVisible();
  await expect(offer.getByRole("button", { name: "Iný bonus" })).toBeVisible();
  await expect(offer.getByRole("button", { name: "Začať" })).toBeVisible();
  await expect(
    page.getByText("Ak máš chuť, môžeš pokračovať bonusom."),
  ).toHaveCount(2);
  await expect(page.getByText("Dnešný cieľ splnený 🎉")).toHaveCount(0);
  await expect(page.getByText("Na dnes stačí")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dnes nie" })).toHaveCount(0);
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-bonus-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-bonus-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await offer.getByRole("button", { name: "Začať" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: first.title })).toBeVisible();
  await expect(dialog).toContainText("bez bodov");
  await dialog.getByRole("button", { name: "Späť" }).click();
  await expect(dialog).toHaveCount(0);

  await offer.getByRole("button", { name: "Hotovo" }).click();
  await expect(
    page.getByText("Bonus zapísaný, body na dnes už máš"),
  ).toBeVisible();
  const burst = page.locator(".collect-burst");
  await expect(burst).toContainText("Zapísané");
  await expect(burst).not.toContainText("+");
  await expect(offer.getByRole("heading", { name: first.title })).toHaveCount(0);
  await expect(offer.getByRole("heading", { level: 3 })).toBeVisible();
  const saved = (await read(page)).completions.find(
    (item) => item.taskId === first.id && !item.undone,
  );
  expect(saved).toMatchObject({ type: "extra", xp: 0, day });

  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "História" }).click();
  await expect(page.getByText(first.title).first()).toBeVisible();
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  const overview = page.getByRole("region", { name: "Prehľad úrovní" });
  if (taskTier(first) === 1) {
    const row = overview.locator("li").filter({ hasText: first.title });
    await expect(row).toContainText("hotové");
    await expect(row).toHaveClass(/is-done/);
    const due = overview.locator("li.is-waiting").first();
    if ((await due.count()) > 0) {
      const dueBox = await due.boundingBox();
      const doneBox = await row.boundingBox();
      expect(dueBox && doneBox && dueBox.y < doneBox.y).toBe(true);
    }
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  if (info.project.name === "mobile-chromium") {
    await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-hierarchy-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await overview.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: "/opt/cursor/artifacts/overview-hierarchy-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await nav(page, "Domov");
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-bonus-done-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/home-bonus-done-desktop.png",
      fullPage: false,
    });
  }
});
