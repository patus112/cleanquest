import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { day, fixture, makeTask } from "../tests/fixture";
import { nav, seed } from "./helpers";

async function ageSafety(page: Page) {
  await page.evaluate(
    async () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("cleanquest");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("safety", "readwrite");
          tx.objectStore("safety").put({
            id: "local",
            revision: 1,
            reminderDays: 7,
            dirtySince: "2026-09-28T12:00:00.000Z",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

test("daily reminders stay calm, dismiss for the day and link to laundry", async ({
  page,
}) => {
  const state = fixture();
  state.tasks.push(
    makeTask(state, {
      id: "wash-ready",
      title: "Vyvesiť jednu dávku bielizne",
      eventAt: "2026-10-05T11:00:00.000Z",
      nextDue: day,
    }),
    makeTask(state, {
      id: "wash-later",
      title: "Ešte beží cyklus",
      eventAt: "2026-10-05T18:00:00.000Z",
      nextDue: day,
    }),
  );
  await seed(page, state);
  await ageSafety(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const reminder = page.getByRole("status", { name: "Malé pripomenutie" });
  await expect(reminder).toBeVisible();
  await expect(
    reminder.getByRole("link", { name: "Na dnes zostávajú 3 kroky." }),
  ).toBeVisible();
  await expect(
    reminder.getByRole("link", { name: "Pranie má pripravený ďalší krok." }),
  ).toBeVisible();
  await expect(reminder.getByText("Ešte beží cyklus")).toHaveCount(0);
  await expect(page.locator(".laundry-notice")).toHaveCount(0);
  await expect(reminder.locator(".backup-reminder")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  await expect(reminder).toHaveCount(0);
  await page.getByRole("button", { name: "Skončiť", exact: true }).click();
  await expect(reminder).toBeVisible();
  await reminder
    .getByRole("link", { name: "Pranie má pripravený ďalší krok." })
    .click();
  await expect(page.getByLabel("Dĺžka cyklu prania")).toBeVisible();
  await expect(
    reminder.getByRole("link", { name: "Pranie má pripravený ďalší krok." }),
  ).toHaveCount(0);
  await nav(page, "Domov");
  await expect(reminder).toBeVisible();
  await reminder.getByRole("button", { name: "Dnes nie" }).click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await expect(reminder).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.setItem("cleanquest-daily-reminder", "2026-10-04");
  });
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(reminder).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00.000Z"));
  await page.evaluate(() => {
    localStorage.setItem("cleanquest-daily-reminder", "2026-10-05");
  });
  await page.reload();
  await expect(reminder).toBeVisible();
  await expect(reminder.getByText("3 sú ešte z tohto týždňa.")).toBeVisible();
});

test("profile explains the iPhone shortcut without a push service", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Profil");
  const guide = page.locator("#ios-reminder");
  await expect(
    guide.getByRole("heading", { name: "Denné pripomenutie na iPhone" }),
  ).toBeVisible();
  await expect(
    guide.getByRole("link", {
      name: "https://patus112.github.io/cleanquest/",
    }),
  ).toHaveAttribute("href", "https://patus112.github.io/cleanquest/");
  await expect(guide).toContainText("Time of Day");
  await expect(guide).toContainText("neposiela upozornenia");
  await expect(guide).toContainText("zamknutom telefóne");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
