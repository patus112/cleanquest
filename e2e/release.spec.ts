import { test, expect } from "@playwright/test";
import { seed, read } from "./helpers";
import { now } from "../tests/fixture";

test("static Pages deep links, exact PWA scope, icons and offline reopening preserve the household", async ({
  page,
  context,
  baseURL,
}) => {
  const base = process.env.VITE_BASE_PATH || "/cleanquest/";
  const origin = new URL(baseURL!).origin;
  // This server deliberately returns 404 instead of rewriting non-file routes.
  expect((await page.request.get(`${origin}${base}profile`)).status()).toBe(
    404,
  );
  await seed(page);
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  await page.getByRole("button", { name: "Mám hotovo" }).click();
  await expect(
    page.getByRole("heading", { name: "Malý krok. Hotovo." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Na dnes si dám pauzu" }).click();
  const saved = await read(page);
  expect(saved.completions).toHaveLength(1);
  expect(saved.completions[0].xp).toBe(10);

  const manifestResponse = await page.request.get(
    `${baseURL}manifest.webmanifest`,
  );
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: base,
    scope: base,
    start_url: base,
    display: "standalone",
    lang: "sk",
  });
  for (const icon of [...manifest.icons, { src: "apple-touch-icon.png" }]) {
    const response = await page.request.get(new URL(icon.src, baseURL).href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL,
    };
  });
  expect(worker).toEqual({
    scope: `${origin}${base}`,
    scriptURL: `${origin}${base}sw.js`,
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  const links = [
    ["home", "Domov"],
    ["tasks?tab=rooms", "Úlohy"],
    ["rewards", "Odmeny"],
    ["ideas", "Nápady"],
    ["profile", "Profil"],
  ];
  for (const offline of [false, true]) {
    await context.setOffline(offline);
    for (const [route, label] of links) {
      await page.goto(`${baseURL}#/${route}`);
      const response = await page.reload();
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(base);
      await expect(
        page
          .getByRole("navigation", { name: "Mobilná navigácia" })
          .getByRole("link", { name: label }),
      ).toHaveAttribute("aria-current", "page");
      expect(await read(page)).toEqual(saved);
    }
  }
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.setFixedTime(now);
  await reopened.goto(`${baseURL}#/profile`);
  await expect(
    reopened.getByRole("heading", { name: "Tvoj rytmus, tvoje pravidlá." }),
  ).toBeVisible();
  expect(await read(reopened)).toEqual(saved);
  await context.setOffline(false);
});
