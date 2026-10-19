import { test, expect } from "@playwright/test";
import { seed, nav } from "./helpers";

test("today overflow menu is clickable above later rows and closes", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Úlohy");
  await expect(
    page.getByRole("heading", { name: "Dnešný plán" }),
  ).toBeVisible();
  const triggers = page.getByRole("button", { name: /^Možnosti:/ });
  expect(await triggers.count()).toBeGreaterThan(1);

  const first = triggers.first();
  await first.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-haspopup", "menu");

  await menu.getByRole("menuitem", { name: "Odložiť na zajtra" }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByText("Úloha počká do zajtra.")).toBeVisible();

  await first.click();
  await page.getByRole("menuitem", { name: "Vynechať dnes" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByText("Stav úlohy bol zmenený.")).toBeVisible();

  await first.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("heading", { name: "Dnešný plán" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(first).toHaveAttribute("aria-expanded", "false");

  await first.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(first).toBeFocused();

  const last = triggers.last();
  await last.evaluate((el) => {
    const nav =
      document.querySelector(".bottom-nav")?.getBoundingClientRect().height ??
      0;
    const rect = el.getBoundingClientRect();
    const targetTop = window.innerHeight - nav - rect.height - 12;
    window.scrollBy(0, rect.top - targetTop);
  });
  await last.click();
  const flipped = page.getByRole("menu");
  await expect(flipped).toBeVisible();
  const box = await flipped.boundingBox();
  const viewport = page.viewportSize();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(box && viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.height).toBeGreaterThan(80);
  const bottomLimit = navBox && navBox.height > 0 ? navBox.y : viewport!.height;
  expect(box!.y + box!.height).toBeLessThanOrEqual(bottomLimit + 1);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
});
