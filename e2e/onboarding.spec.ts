import { test, expect } from "@playwright/test";
import { read } from "./helpers";
import { now } from "../tests/fixture";

for (const prepared of [false, true]) {
  test(`HTTP LAN onboarding creates and persists a ${prepared ? "prepared" : "custom"} household without secure-context UUID APIs`, async ({
    page,
    context,
    baseURL,
  }) => {
    // Route a real insecure origin to our isolated static test server. Loopback
    // alone is trusted by browsers and would conceal the iPhone LAN failure.
    const address = new URL(baseURL!);
    address.hostname = "cleanquest.test";
    await context.route(`${address.origin}/**`, async (route) => {
      const original = new URL(route.request().url());
      const response = await route.fetch({
        url: new URL(original.pathname + original.search, baseURL).href,
      });
      await route.fulfill({ response });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(now);
    await page.goto(address.href);
    expect(
      await page.evaluate(() => ({
        secure: isSecureContext,
        uuid: typeof crypto.randomUUID,
        random: typeof crypto.getRandomValues,
      })),
    ).toEqual({ secure: false, uuid: "undefined", random: "function" });
    if (prepared)
      await page.getByRole("button", { name: "Použiť pripravený dom" }).click();
    await page.getByRole("button", { name: "Pokračovať" }).click();
    await page.getByLabel("Názov domácnosti").fill("Domov cez Wi-Fi");
    await page.getByLabel("Tvoje meno (voliteľné)").fill("Patricia");
    await page.getByRole("button", { name: "Pokračovať" }).click();
    await page.getByRole("button", { name: "Pokračovať" }).click();
    await page.getByRole("button", { name: "30 min", exact: true }).click();
    await page.getByLabel("Tempo").selectOption("gentle");
    await page.getByRole("button", { name: "Vytvoriť môj domov" }).click();
    await expect
      .poll(
        async () =>
          errors.length > 0 ||
          (await page
            .getByRole("heading", { name: "Ahoj, Patricia." })
            .isVisible()),
        // A prepared home writes hundreds of tasks in one transaction. Allow
        // slower CI runners to finish while still surfacing page errors early.
        { timeout: 20_000 },
      )
      .toBe(true);
    expect(errors).toEqual([]);
    await expect(
      page.getByRole("heading", { name: "Ahoj, Patricia." }),
    ).toBeVisible();
    const state = await read(page);
    expect(state.households[0].name).toBe("Domov cez Wi-Fi");
    expect(state.rooms).toHaveLength(prepared ? 14 : 4);
    expect(state.settings[0]).toMatchObject({
      dailyBudget: 30,
      intensity: "gentle",
      restDays: [0],
    });
    await page.getByRole("button", { name: "Začať malý krok" }).click();
    await page.getByRole("button", { name: "Mám hotovo" }).click();
    await expect(
      page.getByRole("heading", { name: "Malý krok. Hotovo." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Na dnes si dám pauzu" }).click();
    const saved = await read(page);
    expect(saved.completions).toHaveLength(1);
    expect(saved.completions[0].xp).toBeGreaterThan(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Ahoj, Patricia." }),
    ).toBeVisible();
    expect(await read(page)).toEqual(saved);
    expect(errors).toEqual([]);
  });
}
