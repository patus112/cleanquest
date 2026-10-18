import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { seed } from "./helpers";
import { now } from "../tests/fixture";

test("waiting update offers the existing backup first when data is unbacked", async ({
  page,
}) => {
  const worker = "dist/sw.js";
  const original = readFileSync(worker);
  try {
    await seed(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await page.evaluate(
      async (dirtySince) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("cleanquest");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("safety", "readwrite");
            tx.objectStore("safety").put({
              id: "local",
              revision: 1,
              reminderDays: 7,
              dirtySince,
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
      now.toISOString(),
    );
    writeFileSync(
      worker,
      Buffer.concat([original, Buffer.from("\n// update\n")]),
    );
    await page.reload();
    const backup = page.getByRole("button", { name: "Uložiť zálohu" });
    await expect(backup).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aktualizovať aj tak" }),
    ).toBeVisible();
    await expect(page.locator(".backup-reminder")).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await backup.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Záloha je pripravená" }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Stiahnuť ZIP" }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^cleanquest-backup-.*\.zip$/,
    );
    await dialog
      .getByRole("button", { name: "Zálohu mám bezpečne uloženú" })
      .click();
    await expect(page.getByText("Uloženie zálohy je potvrdené.")).toBeVisible();
    await expect(backup).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Aktualizovať", exact: true }),
    ).toBeVisible();
  } finally {
    writeFileSync(worker, original);
  }
});
