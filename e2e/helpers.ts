import { expect, type Page } from "@playwright/test";
import { fixture, now } from "../tests/fixture";
import { tables, type State } from "../src/domain/model";
export async function seed(page: Page, s = fixture()) {
  await page.clock.setFixedTime(now);
  await page.goto("./");
  await expect(page.getByText("Začneme tvojím domovom.")).toBeVisible();
  await page.evaluate(async (state) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("cleanquest");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(Object.keys(state), "readwrite");
        for (const [name, rows] of Object.entries(state)) {
          const store = tx.objectStore(name);
          store.clear();
          for (const row of rows) store.put(row);
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, s);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ahoj, Patricia." }),
  ).toBeVisible();
}
export async function read(page: Page): Promise<State> {
  return page.evaluate(
    async (tableNames) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("cleanquest");
        request.onsuccess = () => {
          const db = request.result,
            names = [...tableNames, "photos"];
          const tx = db.transaction(names, "readonly"),
            result: Record<string, unknown> = {};
          for (const name of names) {
            const r = tx.objectStore(name).getAll();
            r.onsuccess = () => {
              result[name] = r.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            const assets = new Map(
              (
                result.photos as {
                  id: string;
                  mime: string;
                  bytes: Uint8Array;
                }[]
              ).map((p) => [p.id, p]),
            );
            delete result.photos;
            const hydrate = (value: unknown): unknown => {
              if (
                typeof value === "string" &&
                value.startsWith("local-photo:")
              ) {
                const asset = assets.get(value.slice(12));
                if (!asset) throw new Error("Missing persisted test photo");
                let binary = "";
                for (const byte of asset.bytes)
                  binary += String.fromCharCode(byte);
                return `data:${asset.mime};base64,${btoa(binary)}`;
              }
              if (Array.isArray(value)) return value.map(hydrate);
              if (value && typeof value === "object")
                return Object.fromEntries(
                  Object.entries(value).map(([key, item]) => [
                    key,
                    hydrate(item),
                  ]),
                );
              return value;
            };
            resolve(hydrate(result) as State);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    tables,
  );
}
export const nav = (page: Page, label: string) =>
  page
    .getByRole("navigation", { name: "Mobilná navigácia" })
    .getByRole("link", { name: label })
    .click();
export async function finishPlan(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Začať malý krok" }).click();
    await page.getByRole("button", { name: "Mám hotovo" }).click();
    await expect(
      page.getByRole("heading", { name: "Malý krok. Hotovo." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Na dnes si dám pauzu" }).click();
  }
}
