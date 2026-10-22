import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import Onboarding from "../src/ui/Onboarding";
import Forms from "../src/ui/Forms";
import Dashboard from "../src/ui/Dashboard";
import { TaskLocation } from "../src/ui/RoomVisual";
import { snapshot } from "../src/domain/scheduler";
import { fixture, now } from "./fixture";
import type { State } from "../src/domain/model";
import BackupPanel from "../src/ui/BackupPanel";
import { LocalRepository, createDatabase } from "../src/persistence/repository";
import { prepareBackup } from "../src/persistence/backup";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("Slovak user journeys", () => {
  it("onboarding allows clearing and replacing household numbers and saves the entered values", async () => {
    const save = vi.fn(async (state: State) => {
      void state;
    });
    render(<Onboarding save={save} error="" busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    for (const label of ["Počet podlaží", "Počet obyvateľov"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "inputmode",
        "numeric",
      );
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "" },
      });
      expect(screen.getByLabelText(label)).toHaveValue(null);
    }
    fireEvent.change(screen.getByLabelText("Počet podlaží"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Počet obyvateľov"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Rozloha v m² (voliteľné)"), {
      target: { value: "120.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "Späť" }));
    expect(screen.getByLabelText("Počet podlaží")).toHaveValue(2);
    expect(screen.getByLabelText("Počet obyvateľov")).toHaveValue(4);
    expect(screen.getByLabelText("Rozloha v m² (voliteľné)")).toHaveValue(
      120.5,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "Vytvoriť môj domov" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].floors).toHaveLength(2);
    expect(save.mock.calls[0][0].households[0]).toMatchObject({
      residentCount: 4,
      totalArea: 120.5,
    });
  });

  it.each([
    ["Počet podlaží", "", "Zadaj počet podlaží"],
    ["Počet podlaží", "0", "Zadaj počet podlaží"],
    ["Počet podlaží", "2.5", "Zadaj počet podlaží"],
    ["Počet podlaží", "11", "Zadaj počet podlaží"],
    ["Počet obyvateľov", "", "Zadaj počet obyvateľov"],
    ["Počet obyvateľov", "0", "Zadaj počet obyvateľov"],
    ["Počet obyvateľov", "4.5", "Zadaj počet obyvateľov"],
    ["Počet obyvateľov", "101", "Zadaj počet obyvateľov"],
    ["Rozloha v m² (voliteľné)", "-1", "Zadaj rozlohu"],
    ["Rozloha v m² (voliteľné)", "100001", "Zadaj rozlohu"],
  ])(
    "onboarding prevents continuing with %s set to '%s'",
    (label, value, message) => {
      const save = vi.fn(async () => {});
      render(<Onboarding save={save} error="" busy={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
      expect(
        screen.getByRole("heading", { name: "Ako voláme tvoj domov?" }),
      ).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("onboarding reports preparation failure and retries without losing chosen settings", async () => {
    const save = vi.fn(async (state: State) => {
      void state;
    });
    render(<Onboarding save={save} error="" busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.change(screen.getByLabelText("Názov domácnosti"), {
      target: { value: "Domov cez Wi-Fi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.change(screen.getByLabelText("Tempo"), {
      target: { value: "gentle" },
    });
    vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("Domov sa nepodarilo pripraviť. Skús to znova.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Vytvoriť môj domov" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Domov sa nepodarilo pripraviť",
    );
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Vytvoriť môj domov" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Vytvoriť môj domov" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].households[0].name).toBe("Domov cez Wi-Fi");
    expect(save.mock.calls[0][0].settings[0]).toMatchObject({
      dailyBudget: 30,
      intensity: "gentle",
    });
  });
  it("onboarding shows a rejected save and enables retry instead of silently failing", async () => {
    const save = vi
      .fn<(_state: State) => Promise<void>>()
      .mockRejectedValueOnce(
        new DOMException("Storage full", "QuotaExceededError"),
      )
      .mockResolvedValue(undefined);
    render(<Onboarding save={save} error="" busy={false} />);
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    fireEvent.click(screen.getByRole("button", { name: "Vytvoriť môj domov" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Úložisko je plné",
    );
    expect(
      screen.getByRole("button", { name: "Vytvoriť môj domov" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Vytvoriť môj domov" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
  it("failed restoration keeps the preview open with an accessible Slovak error and preserves data", async () => {
    const repo = new LocalRepository(
      createDatabase(`backup-ui-${crypto.randomUUID()}`),
    );
    try {
      const s = fixture();
      await repo.replace(s);
      const before = await repo.readSnapshot(),
        prepared = await prepareBackup(before.state, before.safety, now);
      render(
        <BackupPanel
          s={before.state}
          safety={before.safety}
          repository={repo}
          refresh={async () => {}}
          restore={async () => false}
          resetData={async () => false}
          storage={{ persistenceSupported: false }}
          refreshStorage={async () => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Vybrať zálohu"), {
        target: { files: [prepared.file] },
      });
      await screen.findByRole("heading", { name: "Obnoviť túto zálohu?" });
      fireEvent.click(
        screen.getByRole("button", { name: "Potvrdiť nahradenie" }),
      );
      await waitFor(() =>
        expect(
          within(screen.getByRole("dialog")).getByRole("alert"),
        ).toHaveTextContent("Pôvodné údaje zostali zachované"),
      );
      expect(await repo.readSnapshot()).toEqual(before);
      expect(
        screen.getByRole("button", { name: "Potvrdiť nahradenie" }),
      ).toBeEnabled();
    } finally {
      repo.db.close();
      await repo.db.delete();
    }
  });
  it("onboarding creates only selected rooms and furniture", async () => {
    const save = vi.fn(async (state: State) => {
      void state;
    });
    render(<Onboarding save={save} error="" busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Pokračovať/ }));
    fireEvent.change(screen.getByLabelText("Názov domácnosti"), {
      target: { value: "Mamin byt" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pokračovať/ }));
    fireEvent.click(screen.getAllByLabelText("Sušička")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Pokračovať/ }));
    fireEvent.click(screen.getByRole("button", { name: /Vytvoriť môj domov/ }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const state = save.mock.calls[0][0] as State;
    expect(state.households[0].name).toBe("Mamin byt");
    expect(state.objects.some((o) => o.category === "dryer")).toBe(true);
    expect(state.objects.some((o) => o.category === "washer")).toBe(false);
  });
  it("custom task form associates speaker and seven-day recurrence", async () => {
    const s = fixture();
    s.objects[0].category = "speaker";
    const open = vi.fn();
    const run = vi.fn(async (recipe: (s: State) => void) => {
      recipe(s);
      return true;
    });
    render(
      <Forms
        s={s}
        run={run}
        open={open}
        modal={{ kind: "task", roomId: s.rooms[0].id }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Názov úlohy"), {
      target: { value: "Utrieť reproduktory zhora" },
    });
    fireEvent.change(screen.getByLabelText("Predmet (voliteľné)"), {
      target: { value: s.objects[0].id },
    });
    fireEvent.change(screen.getByLabelText("Opakovanie"), {
      target: { value: "day" },
    });
    fireEvent.change(screen.getByLabelText("Interval N"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pridať úlohu" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(null));
    expect(s.tasks.at(-1)!.title).toBe("Utrieť reproduktory zhora");
    expect(s.tasks.at(-1)!.recurrence.interval).toBe(7);
    expect(s.tasks.at(-1)!.objectId).toBe(s.objects[0].id);
  });
  it("dashboard uses DA and offers one-task mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const s = fixture(),
      open = vi.fn();
    render(
      <Dashboard
        s={s}
        open={open}
        run={async () => true}
        navigate={() => {}}
      />,
    );
    expect(screen.getByText("LEN JEDNA VEC")).toBeVisible();
    expect(screen.getByText(/^0 DA ⚡$/)).toBeVisible();
    expect(screen.getByText(/Dnes 0 z /)).toBeVisible();
    expect(screen.getByText("10 min denne")).toBeVisible();
    expect(screen.getByLabelText("Dnešný časový blok")).toHaveValue("10");
    fireEvent.click(screen.getByRole("button", { name: /Začať malý krok/ }));
    expect(open).toHaveBeenCalledWith({ kind: "focus" });
  });
  it("keeps the hard-day label and syncs the daily minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const s = fixture();
    const run = vi.fn(async (recipe: (state: State) => void) => {
      recipe(s);
      return true;
    });
    const view = render(
      <Dashboard s={s} open={vi.fn()} run={run} navigate={vi.fn()} />,
    );
    const hardDay = screen.getByRole("switch", { name: /Ťažký deň/ });
    expect(hardDay).toHaveAttribute("aria-checked", "false");
    expect(hardDay).toHaveTextContent("nie");
    expect(screen.getByText("Čisté")).toHaveAttribute("aria-current", "step");
    await act(async () => {
      fireEvent.click(hardDay);
    });
    view.rerender(
      <Dashboard s={s} open={vi.fn()} run={run} navigate={vi.fn()} />,
    );
    const on = screen.getByRole("switch", { name: /Ťažký deň/ });
    expect(s.settings[0].rescue).toBe(true);
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(on).toHaveTextContent("Ťažký deň");
    expect(on).toHaveTextContent("áno");
    expect(screen.getByText("Základ")).toHaveAttribute("aria-current", "step");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Dnešný časový blok"), {
        target: { value: "30" },
      });
    });
    view.rerender(
      <Dashboard s={s} open={vi.fn()} run={run} navigate={vi.fn()} />,
    );
    expect(s.settings[0].dailyBudget).toBe(30);
    expect(s.dailyPlans.find((plan) => plan.date === "2026-10-05")?.timeBudget).toBe(
      30,
    );
    expect(screen.getByText("30 min denne")).toBeVisible();
    expect(screen.getByLabelText("Dnešný časový blok")).toHaveValue("30");
    expect(s.settings[0].rescue).toBe(true);
  });
  it("completes today's offered task in one tap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const s = fixture();
    const run = vi.fn(
      async (recipe: (state: State) => void, message?: string) => {
        recipe(s);
        void message;
        return true;
      },
    );
    render(
      <Dashboard
        s={s}
        open={vi.fn()}
        run={run}
        navigate={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hotovo" }));
    });
    expect(s.completions).toHaveLength(1);
    expect(s.completions[0]).toMatchObject({ type: "required", xp: 10 });
    expect(run.mock.calls[0][1]).toMatch(/dnes 1 z/);
  });
  it("postpones today's offered task until tomorrow", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const s = fixture();
    const run = vi.fn(async (recipe: (state: State) => void) => {
      recipe(s);
      return true;
    });
    render(
      <Dashboard
        s={s}
        open={vi.fn()}
        run={run}
        navigate={vi.fn()}
      />,
    );
    const title = screen.getByRole("heading", { level: 2, name: /polic/ });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Odložiť na zajtra" }),
      );
    });
    const moved = s.dailyPlans
      .flatMap((p) => p.occurrences)
      .find((o) => o.title === title.textContent);
    expect(moved?.deferredTo).toBe("2026-10-06");
    expect(s.completions).toHaveLength(0);
  });
  it("room editor stores mixed flooring, dimensions, windows and configured textiles", async () => {
    const s = fixture(),
      open = vi.fn();
    render(
      <Forms
        s={s}
        open={open}
        run={async (recipe) => {
          recipe(s);
          return true;
        }}
        modal={{ kind: "room", id: s.rooms[0].id }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rozloha v m²"), {
      target: { value: "22.5" },
    });
    fireEvent.change(screen.getByLabelText("Šírka miestnosti (m)"), {
      target: { value: "4.5" },
    });
    fireEvent.change(screen.getByLabelText("Dĺžka miestnosti (m)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Podlaha"), {
      target: { value: "laminate" },
    });
    fireEvent.click(screen.getByLabelText("Koberec", { exact: true }));
    fireEvent.change(screen.getByLabelText("Plocha: Koberec (m²)"), {
      target: { value: "3.5" },
    });
    fireEvent.change(screen.getByLabelText("Celková plocha okien (m²)"), {
      target: { value: "14" },
    });
    fireEvent.change(screen.getByLabelText("Závesy", { exact: true }), {
      target: { value: "yes" },
    });
    fireEvent.change(screen.getByLabelText("Žalúzie", { exact: true }), {
      target: { value: "no" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(null));
    expect(s.rooms[0]).toMatchObject({
      area: 22.5,
      width: 4.5,
      length: 5,
      flooring: "laminate",
      floorSurfaces: [{ material: "carpet", area: 3.5 }],
      windowArea: 14,
      curtains: true,
      blinds: false,
    });
    expect(s.tasks.some((t) => t.templateId === "curtain-dust")).toBe(true);
    expect(s.objects.some((o) => o.category === "glass")).toBe(false);
  });
  it("task map marks the saved object even after its task association is edited", () => {
    const s = fixture(),
      task = s.tasks[0];
    task.objectId = s.objects[0].id;
    const occurrence = snapshot(s, task, "2026-10-05");
    s.objects.push({
      ...s.objects[0],
      id: "replacement-object",
      name: "Iný predmet",
    });
    task.objectId = "replacement-object";
    const { container } = render(<TaskLocation s={s} task={occurrence} />);
    expect(
      container
        .querySelector('[data-target="true"]')
        ?.getAttribute("data-object-id"),
    ).toBe(occurrence.objectId);
    expect(screen.getByText(/Schematický náhľad;/)).toBeVisible();
  });
  it("focus honors the five-minute block forwarded through the dialog", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const s = fixture();
    s.settings[0].dailyBudget = 5;
    render(
      <Forms
        s={s}
        open={vi.fn()}
        run={async (recipe) => {
          recipe(s);
          return true;
        }}
        modal={{ kind: "focus" }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mám hotovo" }));
    });
    expect(s.completions).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Ponúknuť ďalšiu úlohu" }),
    );
    expect(screen.getByText("Teraz si môžeš vydýchnuť.")).toBeVisible();
  });
});
