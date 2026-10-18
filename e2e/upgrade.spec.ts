import { expect, test } from "@playwright/test";
test("an open tab asks to reload when another connection upgrades the database", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.getByText("Začneme tvojím domovom.")).toBeVisible();
  // Dexie persists schema versions multiplied by 10, so version 5 is native 50.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("cleanquest", 60);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("older tab kept the database open"));
      }),
  );
  await expect(page.getByRole("alert")).toHaveText(
    "CleanQuest sa aktualizoval v inom okne. Obnov túto stránku, aby si mohol pokračovať. Tvoje úlohy, história aj fotografie zostávajú v tomto zariadení.",
  );
  await expect(
    page.getByRole("button", { name: "Obnoviť stránku" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "test-results/upgrade-reload-390.png",
      scale: "css",
    });
  expect(errors).toEqual([]);
});
test("a new tab explains when an older connection blocks the upgrade", async ({
  context,
  page,
}, info) => {
  const holder = await context.newPage();
  await holder.route("**/*", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>hold</title><p>hold</p>",
      });
      return;
    }
    await route.continue();
  });
  await holder.goto("./");
  await holder.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("cleanquest", 40);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("households"))
            db.createObjectStore("households", { keyPath: "id" });
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => undefined;
          Object.assign(window, { hold: db });
          resolve();
        };
        request.onerror = () => reject(request.error);
      }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.getByRole("alert")).toHaveText(
    "Iné okno ešte používa staršiu verziu CleanQuest. Zavri ho alebo ho obnov. Táto stránka potom pokračuje sama a nič sa nemaže.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-chromium")
    await page.screenshot({
      path: "test-results/upgrade-blocked-390.png",
      scale: "css",
    });
  await holder.evaluate(() => {
    (window as unknown as { hold: IDBDatabase }).hold.close();
  });
  await expect(page.getByText("Začneme tvojím domovom.")).toBeVisible();
});
