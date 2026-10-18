import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seed, read, nav } from "./helpers";

test("home opens on today's task, completes in one tap and postpones the next", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const card = page.locator(".next-card");
  const title = card.getByRole("heading", { level: 2 });
  await expect(title).toBeVisible();
  const first = (await title.textContent()) || "";
  const done = card.getByRole("button", { name: "Hotovo" });
  const later = card.getByRole("button", { name: "Odložiť na zajtra" });
  for (const button of [done, later]) {
    const box = await button.boundingBox();
    expect(box && box.height >= 44 && box.width >= 44).toBe(true);
    expect(box!.y + box!.height).toBeLessThan(760);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await done.click();
  await expect(page.getByText(/Hotovo\..*dnes 1 z/)).toBeVisible();
  await expect(card).toContainText("Dnes 1 z");
  await expect(title).not.toHaveText(first);
  expect((await read(page)).completions).toHaveLength(1);
  expect((await read(page)).completions[0].xp).toBeGreaterThan(0);
  const second = (await title.textContent()) || "";
  await later.click();
  await expect(page.getByText("Úloha počká do zajtra.")).toBeVisible();
  await expect(title).not.toHaveText(second);
  expect(
    (await read(page)).dailyPlans
      .flatMap((plan) => plan.occurrences)
      .some(
        (item) => item.title === second && item.deferredTo === "2026-10-06",
      ),
  ).toBe(true);
  await nav(page, "Úlohy");
  const postpone = page
    .getByRole("button", { name: /Odložiť na zajtra:/ })
    .first();
  await expect(postpone).toBeVisible();
  const postponeBox = await postpone.boundingBox();
  expect(postponeBox && postponeBox.height >= 44).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await nav(page, "Domov");
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Odložiť na zajtra" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Odložiť na zajtra" }).click();
  await expect(page.getByText("Úloha počká do zajtra.")).toBeVisible();
});
