import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, makeTask } from "../tests/fixture";
import { nav, seed } from "./helpers";

async function axe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("every completion shows confetti and the task value", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const state = fixture();
  state.tasks.push(
    makeTask(state, {
      id: "basic-sill",
      title: "Pozametať prah",
      tier: 1,
      duration: 2,
      nextDue: "2026-10-20",
    }),
  );
  await seed(page, state);
  await page.setViewportSize({ width: 390, height: 844 });
  const hud = page.getByRole("region", { name: "Tvoj pokrok" });
  await expect(hud).toBeVisible();
  await expect(hud).toContainText("0 / 10 min");
  await expect(hud).toContainText("DA dnes 0");
  await expect(hud.getByText(/Do týždennej odmeny chýba|Týždenná odmena/)).toBeVisible();
  await expect(page.getByText(/zostáva \d+/)).toHaveCount(0);
  await expect(page.getByText(/z tohto týždňa/)).toHaveCount(0);
  await axe(page);
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-home-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-home-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  const xp = Number(
    (await page.locator(".next-card .task-meta").innerText()).match(
      /\+(\d+) DA/,
    )?.[1],
  );
  expect(xp).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Hotovo" }).click();
  const burst = page.locator(".collect-burst");
  await expect(burst).toBeVisible();
  await expect(burst).toContainText(`+${xp} DA`);
  await expect(burst).toContainText(/spolu \d+ DA/);
  await expect(burst.locator("canvas")).toHaveCount(1);
  await expect(burst).toHaveAttribute("data-reduced", "false");
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-complete-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-complete-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await expect(burst).toHaveCount(0);

  await nav(page, "Úlohy");
  await expect(hud).toBeVisible();
  await page.getByRole("tab", { name: "História" }).click();
  await page.getByRole("button", { name: /Vrátiť dokončenie/ }).click();
  await expect(page.getByText("Dokončenie a odmeny boli opravené.")).toBeVisible();
  await expect(page.locator(".collect-burst")).toHaveCount(0);

  await page.getByRole("tab", { name: "Dnes" }).click();
  await page.getByRole("button", { name: /^Dokončiť:/ }).first().click();
  await expect(page.locator(".collect-burst")).toContainText(/\+\d+ DA/);
  await expect(page.locator(".collect-burst canvas")).toHaveCount(1);
  await expect(page.locator(".collect-burst")).toHaveCount(0);
  if (info.project.name === "mobile-chromium") {
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-tasks-390.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-tasks-desktop.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await axe(page);

  await nav(page, "Domov");
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  const dialog = page.getByRole("dialog");
  const focusXp = Number(
    (await dialog.locator(".task-meta").innerText()).match(/(\d+) DA/)?.[1],
  );
  expect(focusXp).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Mám hotovo" }).click();
  await expect(page.locator(".collect-burst")).toContainText(`+${focusXp} DA`);
  await expect(page.locator(".collect-burst canvas")).toHaveCount(1);
  expect(
    await page.evaluate(() => {
      const award = document.querySelector(".collect-award");
      if (!(award instanceof HTMLElement)) return false;
      const box = award.getBoundingClientRect();
      award.style.pointerEvents = "auto";
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return !!hit && (hit === award || award.contains(hit));
    }),
  ).toBe(true);
  await expect(page.locator(".collect-burst")).toHaveCount(0);
  await page.getByRole("button", { name: "Na dnes si dám pauzu" }).click();

  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  await page
    .getByRole("button", { name: "Označiť ako hotové: Pozametať prah" })
    .click();
  await expect(page.locator(".collect-burst")).toContainText("+10 DA");
  await expect(page.locator(".collect-burst")).toHaveCount(0);

  await nav(page, "Domov");
  await page.getByRole("button", { name: "Rýchla úloha" }).click();
  await page.getByLabel("Názov").fill("Zložiť deku z pohovky");
  await page.getByLabel("Trvanie (minúty)").fill("1");
  await page.getByRole("button", { name: "Už mám hotové" }).click();
  await expect(page.locator(".collect-burst")).toContainText("+10 DA");
  await expect(page.getByText("Zapísané. Malý krok sa počíta.")).toBeVisible();
});

test("reduced motion keeps the award and skips confetti", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Hotovo" }).click();
  const burst = page.locator(".collect-burst");
  await expect(burst).toBeVisible();
  await expect(burst).toHaveAttribute("data-reduced", "true");
  await expect(burst.locator("canvas")).toHaveCount(0);
  await expect(burst).toContainText(/\+\d+ DA/);
  await expect(burst).toContainText(/spolu \d+ DA/);
  await axe(page);
});
