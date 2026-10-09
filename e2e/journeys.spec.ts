import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seed, read, nav, finishPlan } from "./helpers";
import { fixture, now } from "../tests/fixture";
import { ensurePlans } from "../src/domain/scheduler";
test("new household, custom speaker task, mobile layout and accessible navigation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto("./");
  await page.getByRole("button", { name: "Pokračovať" }).click();
  await page.getByLabel("Názov domácnosti").fill("Mamin byt");
  await page.getByLabel("Tvoje meno (voliteľné)").fill("Mama");
  await page.getByRole("button", { name: "Pokračovať" }).click();
  const kitchen = page.locator(".room-choices>div").filter({
    has: page.getByRole("checkbox", { name: "Kuchyňa", exact: true }),
  });
  await kitchen.locator("summary").click();
  await kitchen
    .getByRole("checkbox", { name: "Chladnička", exact: true })
    .check();
  await page.getByRole("button", { name: "Pokračovať" }).click();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Vytvoriť môj domov" }).click();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Mama." }),
  ).toBeVisible();
  const state = await read(page);
  expect(state.settings[0].dailyBudget).toBe(5);
  expect(state.tasks.some((t) => t.templateId?.startsWith("dryer"))).toBe(
    false,
  );
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  await page.getByRole("button", { name: /Obývačka.*malých úloh/ }).click();
  await page.getByRole("button", { name: "Pridať predmet" }).click();
  await page.getByLabel("Názov", { exact: true }).fill("Reproduktory");
  await page.getByLabel("Kategória", { exact: true }).selectOption("speaker");
  await page.getByLabel("Pridať vhodné malé úlohy zo šablón").uncheck();
  await page.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(
    page.locator(".inventory-row").getByText("Reproduktory", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pridať úlohu" }).first().click();
  await page.getByLabel("Názov úlohy").fill("Utrieť reproduktory zhora");
  await page
    .getByLabel("Predmet (voliteľné)")
    .selectOption({ label: "Reproduktory" });
  await page.getByLabel("Opakovanie").selectOption("day");
  await page.getByLabel("Interval N").fill("7");
  await page
    .getByRole("button", { name: "Pridať úlohu", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Utrieť reproduktory zhora" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Knižnica" }).click();
  await expect(
    page.getByRole("heading", { name: "Utrieť reproduktory zhora" }),
  ).toBeVisible();
  await nav(page, "Domov");
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("daily completion, two bounded extras, independent bonus, wallet and undo", async ({
  page,
}) => {
  await seed(page);
  await finishPlan(page);
  expect((await read(page)).rewards.reduce((n, r) => n + r.cents, 0)).toBe(
    2000,
  );
  await nav(page, "Odmeny");
  for (const title of [
    "Vybrať veci z jednej police",
    "Utrieť prázdnu policu",
    "Odložiť veci, ktoré sem patria",
  ])
    await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByText("Výzva dokončená")).toBeVisible();
  await page.getByRole("button", { name: "Zaznamenať využitie" }).click();
  await page.getByLabel("Suma (€)").fill("7.35");
  await page.getByLabel("Na čo si odmenu použila?").fill("Kniha");
  await page.getByRole("button", { name: "Uložiť", exact: true }).click();
  await nav(page, "Domov");
  for (let i = 0; i < 2; i++)
    await page
      .locator(".extra-card")
      .getByRole("button", { name: /Hotovo/ })
      .click();
  await expect(
    page.getByRole("heading", { name: "Na dnes stačí. Pokračujeme zajtra." }),
  ).toBeVisible();
  expect(
    (await read(page)).completions.filter((c) => c.type === "extra"),
  ).toHaveLength(2);
  expect((await read(page)).completions.reduce((n, c) => n + c.xp, 0)).toBe(30);
  expect((await read(page)).rewards.reduce((n, r) => n + r.cents, 0)).toBe(
    1765,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Na dnes stačí. Pokračujeme zajtra." }),
  ).toBeVisible();
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "História" }).click();
  await page
    .getByRole("button", {
      name: "Vrátiť dokončenie Utrieť malú policu 1",
      exact: true,
    })
    .click();
  await expect(page.getByText("Vrátené", { exact: true })).toBeVisible();
  expect((await read(page)).rewards.reduce((n, r) => n + r.cents, 0)).toBe(
    -235,
  );
});
test("household problem to Mega quest, backup preview, clear and restore", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "Nápady");
  await page.getByRole("button", { name: "Toto ma štve" }).first().click();
  await page.getByLabel("Čo ťa štve?").fill("V skrinke pri vchode je chaos.");
  await page.getByRole("button", { name: "Uložiť", exact: true }).click();
  await page.getByRole("button", { name: "Vybrať ako Mega výzvu" }).click();
  await expect(
    page
      .getByRole("heading", { name: "V skrinke pri vchode je chaos." })
      .first(),
  ).toBeVisible();
  await page.locator(".mega-card .step").first().click();
  await page.locator(".mega-card .step").nth(1).click();
  await page.locator(".mega-card .step").nth(2).click();
  await page.locator(".mega-card .step").nth(3).click();
  await expect(
    page.getByText("Vyriešené. +500 DA ⚡ za zlepšenie domova."),
  ).toBeVisible();
  await nav(page, "Profil");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportovať zálohu" }).click();
  await page.getByRole("button", { name: "Stiahnuť ZIP", exact: true }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  const before = await read(page);
  await page.getByRole("button", { name: "Zatvoriť bez potvrdenia" }).click();
  await page.getByText("Úložisko a ochrana údajov", { exact: true }).click();
  await page
    .getByRole("button", { name: "Vymazať všetky miestne údaje" })
    .click();
  await page.getByRole("button", { name: "Potvrdiť vymazanie" }).click();
  await expect(page.getByText("Začneme tvojím domovom.")).toBeVisible();
  // Empty-install recovery uses the same validated import preview as the profile.
  await page
    .locator(
      'input[type=file][accept=".zip,.json,application/zip,application/json"]',
    )
    .setInputFiles(file!);
  await expect(
    page.getByRole("heading", { name: "Obnoviť túto zálohu?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Potvrdiť nahradenie" }).click();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Patricia." }),
  ).toBeVisible();
  expect((await read(page)).megas).toEqual(before.megas);
  expect((await read(page)).problems).toEqual(before.problems);
});
test("production assets, cached offline launch and saved completion", async ({
  page,
  context,
}) => {
  await seed(page);
  const manifest = await page.request.get("manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const m = await manifest.json();
  expect(m.scope).toBe(process.env.VITE_BASE_PATH || "/cleanquest/");
  expect(m.start_url).toBe(process.env.VITE_BASE_PATH || "/cleanquest/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Safari may finish claiming the initial tab only after a new navigation.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 15000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Patricia." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Začať malý krok" }).click();
  await page.getByRole("button", { name: "Mám hotovo" }).click();
  await expect(
    page.getByRole("heading", { name: "Malý krok. Hotovo." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Na dnes si dám pauzu" }).click();
  await page.reload();
  expect((await read(page)).completions).toHaveLength(1);
  await context.setOffline(false);
});

test("light mode, desktop layout and household configuration remain accessible", async ({
  page,
}, info) => {
  await seed(page);
  await nav(page, "Profil");
  await page.getByLabel("Vzhľad", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await nav(page, "Domov");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "Hlavná navigácia" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/desktop-light-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("room details, positioned objects and the highlighted upstairs sink persist", async ({
  page,
}, info) => {
  const s = fixture(false),
    hid = s.households[0].id;
  s.floors.push({
    id: "upper-floor",
    householdId: hid,
    name: "Horné podlažie",
    order: 1,
  });
  s.rooms.push({
    id: "upper-bathroom",
    householdId: hid,
    floorId: "upper-floor",
    name: "Horná kúpeľňa",
    category: "bathroom",
    flooring: "tile",
    order: 1,
    enabled: true,
    zones: [],
  });
  s.objects.push({
    id: "upper-sink",
    householdId: hid,
    roomId: "upper-bathroom",
    name: "Horné umývadlo",
    category: "sink",
    quantity: 1,
    dimensions: "",
    surface: "Keramika",
    accessibility: "safe",
    notes: "",
  });
  s.tasks = [
    {
      ...s.tasks[0],
      roomId: "upper-bathroom",
      objectId: "upper-sink",
      title: "Umyť umývadlo",
      instructions:
        "Opláchni a jemne utri vnútro jedného umývadla. Stačí táto malá plocha.",
      recurrence: { ...s.tasks[0].recurrence, unit: "day", interval: 7 },
    },
  ];
  ensurePlans(s, "2026-10-05", now.toISOString());
  const requiredId = s.weeks[0].required[0].id;
  await seed(page, s);
  await nav(page, "Profil");
  await page
    .getByRole("button", { name: "Horné podlažie", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Horná kúpeľňa.*Rozloha nezadaná/ })
    .click();
  await page.getByLabel("Rozloha v m²").fill("8.5");
  await page.getByLabel("Šírka miestnosti (m)").fill("2.5");
  await page.getByLabel("Dĺžka miestnosti (m)").fill("3.4");
  await page.getByLabel("Koberec", { exact: true }).check();
  await page.getByLabel("Plocha: Koberec (m²)").fill("0.8");
  await page.getByLabel("Celková plocha okien (m²)").fill("2.8");
  await page.getByLabel("Závesy", { exact: true }).selectOption("no");
  await page.getByLabel("Žalúzie", { exact: true }).selectOption("yes");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Uložiť", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await read(page);
  expect(saved.rooms.find((r) => r.id === "upper-bathroom")).toMatchObject({
    area: 8.5,
    width: 2.5,
    length: 3.4,
    floorSurfaces: [{ material: "carpet", area: 0.8 }],
    windowArea: 2.8,
    curtains: false,
    blinds: true,
  });
  expect(saved.objects.some((o) => o.category === "glass")).toBe(false);
  expect(saved.weeks[0].required[0].id).toBe(requiredId);
  await page
    .getByRole("button", { name: "Miestnosti, predmety a úlohy" })
    .click();
  await expect(page.getByRole("tab", { name: "Miestnosti" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page
    .getByRole("button", { name: /Horná kúpeľňa.*malých úloh/ })
    .click();
  await page
    .getByRole("button", {
      name: "Upraviť predmet Horné umývadlo",
      exact: true,
    })
    .click();
  await page.getByLabel("Rozmery (voliteľné)").fill("70 × 50 cm");
  await page.getByLabel("Poloha v náhľade").selectOption("80,20");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Uložiť", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Každých 7 dní", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/room-details-${info.project.name}.png`,
    fullPage: true,
  });
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
    dialog.getByRole("button", { name: "Mám hotovo" }),
  ).toBeInViewport({ ratio: 1 });
  await expect(dialog.locator(".map-room.is-active")).toContainText(
    "Horná kúpeľňa",
  );
  await expect(dialog.locator('[data-target="true"]')).toHaveAttribute(
    "data-object-id",
    "upper-sink",
  );
  await expect(
    dialog.getByText("Horné umývadlo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/focus-map-${info.project.name}.png`,
    fullPage: false,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Mám hotovo" }).click();
  await expect(
    page.getByRole("heading", { name: "Malý krok. Hotovo." }),
  ).toBeVisible();
  await page.reload();
  const reloaded = await read(page);
  expect(reloaded.completions).toHaveLength(1);
  expect(reloaded.objects.find((o) => o.id === "upper-sink")?.position).toEqual(
    { x: 80, y: 20 },
  );
  await nav(page, "Profil");
  await page.getByLabel("Vzhľad", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("room objects can be dragged, nudged, cancelled and moved with their tasks", async ({
  page,
}, info) => {
  const s = fixture(false),
    base = s.objects[0],
    sourceRoom = s.rooms[0];
  s.rooms.push({
    ...sourceRoom,
    id: "destination-room",
    name: "Pracovňa",
    category: "bedroom",
    order: 1,
  });
  s.objects = [
    {
      ...base,
      id: "movable-cabinet",
      name: "Skrinka",
      category: "cabinet",
      position: { x: 20, y: 20 },
    },
    {
      ...base,
      id: "room-sofa",
      name: "Pohovka",
      category: "sofa",
      position: { x: 75, y: 55 },
    },
    {
      ...base,
      id: "room-speakers",
      name: "Reproduktory",
      category: "speaker",
      position: { x: 20, y: 80 },
    },
  ];
  s.tasks[0].objectId = "movable-cabinet";
  s.tasks[1].objectId = "movable-cabinet";
  ensurePlans(s, "2026-10-05", now.toISOString());
  await seed(page, s);
  await nav(page, "Úlohy");
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  await page.getByRole("button", { name: /Obývačka.*malých úloh/ }).click();
  await page
    .getByRole("button", { name: "Presúvať predmety", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    target = dialog.getByRole("button", {
      name: "Presunúť Skrinka",
      exact: true,
    });
  await target.scrollIntoViewIfNeeded();
  const initialTransform = await target.getAttribute("transform"),
    box = (await target.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (info.project.name === "mobile-chromium") {
    // A real touch sequence verifies pointer capture and touch-action on mobile.
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    for (let step = 1; step <= 8; step++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x + step * 5, y: start.y + step * 6, id: 1 }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 48, { steps: 8 });
    await page.mouse.up();
  }
  await expect(target).not.toHaveAttribute("transform", initialTransform!);
  expect((await read(page)).objects[0].position).toEqual({ x: 20, y: 20 });
  await dialog
    .getByRole("button", { name: "Posunúť doprava", exact: true })
    .click();
  await target.focus();
  await target.press("ArrowDown");
  await expect(
    dialog.getByRole("button", { name: "Uložiť rozloženie", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: `test-results/room-layout-${info.project.name}.png`,
    fullPage: false,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Uložiť rozloženie", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const saved = await read(page),
    position = saved.objects.find((o) => o.id === "movable-cabinet")!.position!;
  expect(position.x).toBeGreaterThan(20);
  expect(position.y).toBeGreaterThan(20);
  expect(saved.weeks).toEqual(s.weeks);
  expect(saved.tasks).toEqual(s.tasks);
  await page.reload();
  expect(
    (await read(page)).objects.find((o) => o.id === "movable-cabinet")
      ?.position,
  ).toEqual(position);
  await page.getByRole("tab", { name: "Miestnosti" }).click();
  await page.getByRole("button", { name: /Obývačka.*malých úloh/ }).click();
  await page
    .getByRole("button", { name: "Presúvať predmety", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Automaticky rozložiť všetko" })
    .click();
  await dialog.getByRole("button", { name: "Zrušiť", exact: true }).click();
  expect(
    (await read(page)).objects.find((o) => o.id === "movable-cabinet")
      ?.position,
  ).toEqual(position);
  await page
    .getByRole("button", {
      name: "Presunúť predmet Skrinka do inej miestnosti",
      exact: true,
    })
    .click();
  await page.getByLabel("Cieľová miestnosť").selectOption("destination-room");
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const moved = await read(page);
  expect(moved.objects.find((o) => o.id === "movable-cabinet")?.roomId).toBe(
    "destination-room",
  );
  expect(
    moved.tasks
      .filter((t) => t.objectId === "movable-cabinet")
      .every((t) => t.roomId === "destination-room"),
  ).toBe(true);
  expect(
    moved.weeks[0].required.map((o) => [
      o.id,
      o.taskId,
      o.date,
      o.xp,
      o.duration,
    ]),
  ).toEqual(
    s.weeks[0].required.map((o) => [o.id, o.taskId, o.date, o.xp, o.duration]),
  );
  expect(moved.completions).toEqual(s.completions);
  expect(moved.rewards).toEqual(s.rewards);
  await page
    .getByRole("button", { name: "← Všetky miestnosti", exact: true })
    .click();
  await page.getByRole("button", { name: /Pracovňa.*malých úloh/ }).click();
  await expect(
    page.locator(".inventory-row").getByText("Skrinka", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upraviť predmet Skrinka", exact: true })
    .click();
  await page.getByLabel("Miestnosť predmetu").selectOption(sourceRoom.id);
  await dialog.getByRole("button", { name: "Uložiť", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await read(page)).tasks[0].roomId).toBe(sourceRoom.id);
});
