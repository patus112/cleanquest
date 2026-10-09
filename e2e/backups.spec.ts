import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import { createHousehold } from "../src/data/household";
import { ensurePlans } from "../src/domain/scheduler";
import { totalXp, balance } from "../src/domain/rewards";
import { canonicalState } from "../src/persistence/repository";
import type { LocalSafety } from "../src/domain/localSafety";
import { fixture, now } from "../tests/fixture";
import { seed, read, nav, finishPlan } from "./helpers";

async function stored<T>(page: Page, name: string): Promise<T[]> {
  return page.evaluate(
    async (storeName) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("cleanquest");
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(storeName, "readonly"),
            rows = tx.objectStore(storeName).getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(rows.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    name,
  );
}
const safety = async (page: Page) =>
  (await stored<LocalSafety>(page, "safety"))[0];
const archiveInput = (page: Page) =>
  page.locator(
    'input[type=file][accept=".zip,.json,application/zip,application/json"]',
  );

function familyHousehold() {
  const state = createHousehold(
    {
      name: "Náš rodinný dom",
      displayName: "Patricia",
      type: "house",
      area: 160,
      floors: 2,
      residents: 3,
      children: true,
      pets: false,
      template: true,
      rooms: [],
      budget: 10,
      restDays: [0, 2, 3, 4, 5, 6],
      monetary: true,
      intensity: "balanced",
      specialNeeds: "Jemné prostriedky na drevo.",
    },
    now,
  );
  state.households[0].timezone = "Europe/Bratislava";
  // Retain the entire real inventory and generated library while making today's obligations deterministic.
  for (const task of state.tasks) task.nextDue = "2026-10-12";
  const living = state.rooms.find((r) => r.category === "living")!;
  state.tasks.push(
    ...fixture(false)
      .tasks.slice(0, 3)
      .map((t) => ({
        ...t,
        householdId: state.households[0].id,
        roomId: living.id,
      })),
  );
  state.wishes.push({
    id: "coffee-wishlist",
    householdId: state.households[0].id,
    title: "Kávovar",
    cents: 5000,
    redeemedCents: 0,
  });
  ensurePlans(state, "2026-10-05", now.toISOString());
  return state;
}

test("complete mobile ZIP recovery with a family home, optimized photos, history, DA and wallet", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, familyHousehold());
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 1800;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 3000, 1800);
    gradient.addColorStop(0, "#a5d6b2");
    gradient.addColorStop(1, "#252b29");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 3000, 1800);
    ctx.fillStyle = "#d4bd83";
    ctx.fillRect(500, 300, 700, 700);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const upload = {
    name: "domacnost.png",
    mimeType: "image/png",
    buffer: Buffer.from(photo, "base64"),
  };
  await nav(page, "Profil");
  await page
    .getByRole("button", { name: "Pridať miestnosť", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Názov", { exact: true }).fill("Pracovňa");
  await dialog.getByLabel("Kategória", { exact: true }).selectOption("other");
  await dialog.getByLabel("Rozloha v m²").fill("11");
  await dialog.locator('input[name="photo"]').setInputFiles(upload);
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  await page.getByRole("button", { name: /Pracovňa.*malých úloh/ }).click();
  await page
    .getByRole("button", { name: "Pridať predmet", exact: true })
    .click();
  await dialog.getByLabel("Názov", { exact: true }).fill("Pracovná skrinka");
  await dialog.getByLabel("Kategória", { exact: true }).selectOption("cabinet");
  await dialog.getByLabel("Pridať vhodné malé úlohy zo šablón").uncheck();
  await dialog.locator('input[name="photo"]').setInputFiles(upload);
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Pridať úlohu" }).first().click();
  await dialog
    .getByLabel("Názov úlohy")
    .fill("Utrieť jednu policu pracovnej skrinky");
  await dialog
    .getByLabel("Predmet (voliteľné)")
    .selectOption({ label: "Pracovná skrinka" });
  await dialog.getByLabel("Prvá / ďalšia úloha").fill("2026-10-12");
  await dialog.getByLabel("Opakovanie").selectOption("day");
  await dialog.getByLabel("Interval N").fill("7");
  await dialog
    .getByRole("button", { name: "Pridať úlohu", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await nav(page, "Domov");
  await finishPlan(page);
  await nav(page, "Odmeny");
  await page.getByRole("button", { name: "Zaznamenať využitie" }).click();
  await page.getByLabel("Suma (€)").fill("2.35");
  await page.getByLabel("Na čo si odmenu použila?").fill("Káva");
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await nav(page, "Nápady");
  await page.getByRole("button", { name: "Toto ma štve" }).first().click();
  await dialog.getByLabel("Čo ťa štve?").fill("V pracovnej skrinke je chaos.");
  await dialog.locator('input[name="photo"]').setInputFiles(upload);
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Vybrať ako Mega výzvu" }).click();
  await page.locator(".mega-card .step").first().click();
  await page.getByText("Upraviť projekt a fotografie", { exact: true }).click();
  await page.locator('input[name="before"]').setInputFiles(upload);
  await page.getByRole("button", { name: "Uložiť projekt" }).click();
  await nav(page, "Profil");
  await page.getByLabel("Pripomínať zálohu").selectOption("14");
  await page.reload();
  await expect(page.getByLabel("Pripomínať zálohu")).toHaveValue("14");
  const before = await read(page);
  expect(before.rooms).toHaveLength(15);
  expect(before.tasks.length).toBeGreaterThan(100);
  expect(before.rooms.find((r) => r.name === "Pracovňa")?.photo).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  expect(before.problems[0].photos).toHaveLength(1);
  expect(before.megas[0].before).toBeTruthy();
  expect(totalXp(before)).toBe(30);
  expect(balance(before)).toBe(1765);
  const photos = await stored<{ bytes: Uint8Array; mime: string }>(
    page,
    "photos",
  );
  expect(photos).toHaveLength(4);
  expect(
    photos.every(
      (p) => p.mime === "image/jpeg" && p.bytes.byteLength < 2000000,
    ),
  ).toBe(true);
  const dimensions = await page.evaluate(
    async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    },
    before.rooms.find((r) => r.name === "Pracovňa")!.photo!,
  );
  expect(dimensions).toEqual([1600, 960]);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Zálohovanie a obnova" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exportovať zálohu" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Záloha je pripravená" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Zálohu mám bezpečne uloženú" }),
  ).toBeDisabled();
  expect((await safety(page)).confirmed).toBeUndefined();
  expect((await safety(page)).lastExport?.revision).toBe(
    (await safety(page)).revision,
  );
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Stiahnuť ZIP", exact: true })
    .click();
  const downloaded = await download,
    path = (await downloaded.path())!;
  expect(downloaded.suggestedFilename()).toMatch(
    /^cleanquest-backup-2026-10-05-\d{4}\.zip$/,
  );
  const bytes = await readFile(path),
    files = unzipSync(bytes),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.photoCount).toBe(1); // Four identical optimized attachments share one ZIP asset.
  expect(manifest.records.rooms).toBe(15);
  expect(manifest.records.completions).toBe(3);
  for (const [name, hash] of Object.entries(manifest.checksums))
    expect(createHash("sha256").update(files[name]).digest("hex")).toBe(hash);
  await dialog
    .getByRole("button", { name: "Zálohu mám bezpečne uloženú" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Aktuálna záloha je potvrdená", { exact: true }),
  ).toBeVisible();
  await page
    .locator("#backup-settings")
    .screenshot({ path: `test-results/backups-${info.project.name}.png` });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const photoPath = manifest.photos[0].path;
  files[photoPath][100] ^= 1;
  await archiveInput(page).setInputFiles({
    name: "poskodena.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync(files)),
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Kontrolný súčet zálohy nesúhlasí" }),
  ).toBeVisible();
  expect(canonicalState(await read(page))).toBe(canonicalState(before));
  await archiveInput(page).setInputFiles(path);
  await expect(
    dialog.getByText("Priložené fotografie: 4", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Štruktúra, fotografie, vzťahy a kontrolné súčty sú overené.",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Zálohovať terajšie údaje" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Zálohovať terajšie údaje" })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Záloha je pripravená" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Zatvoriť bez potvrdenia" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Obnoviť túto zálohu?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Zrušiť", exact: true }).click();
  expect(canonicalState(await read(page))).toBe(canonicalState(before));
  await page.getByText("Úložisko a ochrana údajov", { exact: true }).click();
  await page
    .getByRole("button", { name: "Vymazať všetky miestne údaje" })
    .click();
  await dialog.getByRole("button", { name: "Potvrdiť vymazanie" }).click();
  await expect(page.getByText("Začneme tvojím domovom.")).toBeVisible();
  expect((await stored(page, "photos")).length).toBe(0);
  await archiveInput(page).setInputFiles(path);
  await expect(dialog.getByText(/30 DA ⚡.*17,65/)).toBeVisible();
  await page.screenshot({
    path: `test-results/restore-preview-${info.project.name}.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Potvrdiť nahradenie" }).click();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Patricia." }),
  ).toBeVisible();
  await page.reload();
  expect(canonicalState(await read(page))).toBe(canonicalState(before));
  expect((await stored(page, "photos")).length).toBe(4);
  expect((await safety(page)).reminderDays).toBe(14);
  await nav(page, "Profil");
  await archiveInput(page).setInputFiles(path);
  await dialog.getByRole("button", { name: "Potvrdiť nahradenie" }).click();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Patricia." }),
  ).toBeVisible();
  expect(canonicalState(await read(page))).toBe(canonicalState(before));
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test("backup reminders stay out of focus mode and postponement survives reload", async ({
  page,
}) => {
  await seed(page);
  // Age only this isolated test database; the clock and cleaning plan stay unchanged.
  await page.evaluate(
    async () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("cleanquest");
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("safety", "readwrite");
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
      }),
  );
  await page.reload();
  const reminder = page.locator(".backup-reminder");
  await expect(reminder).toBeVisible();
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  await expect(reminder).toHaveCount(0);
  await page.getByRole("button", { name: "Skončiť", exact: true }).click();
  await expect(reminder).toBeVisible();
  await reminder.getByRole("button", { name: "O týždeň", exact: true }).click();
  await expect(reminder).toHaveCount(0);
  const postponed = await safety(page);
  expect(postponed.revision).toBe(1);
  expect(postponed.snoozedUntil).toBe("2026-10-12T12:00:00.000Z");
  await page.reload();
  await expect(reminder).toHaveCount(0);
  await nav(page, "Profil");
  await page.getByLabel("Pripomínať zálohu").selectOption("0");
  await page.reload();
  await expect(page.getByLabel("Pripomínať zálohu")).toHaveValue("0");
});
