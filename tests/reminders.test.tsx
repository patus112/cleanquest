import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultSafety } from "../src/domain/localSafety";
import { currentTasks } from "../src/domain/scheduler";
import {
  collectDailyReminders,
  laundryLine,
  visibleReminder,
} from "../src/domain/reminders";
import DailyReminder from "../src/ui/DailyReminder";
import {
  readReminderDismissed,
  writeReminderDismissed,
} from "../src/ui/reminderDismiss";
import { day, fixture, makeTask, now } from "./fixture";

afterEach(() => {
  cleanup();
  localStorage.clear();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("daily reminder copy and selection", () => {
  it("uses Slovak plural forms for laundry only", () => {
    expect(laundryLine(1)).toBe("Pranie má pripravený ďalší krok.");
    expect(laundryLine(2)).toBe("Pranie má pripravené 2 ďalšie kroky.");
    expect(laundryLine(6)).toBe("Pranie má pripravených 6 ďalších krokov.");
  });

  it("collects today's open steps, a ready laundry follow-up and a due backup", () => {
    const state = fixture();
    state.tasks.push(
      makeTask(state, {
        id: "wash-ready",
        eventAt: "2026-10-05T11:00:00.000Z",
        nextDue: day,
      }),
      makeTask(state, {
        id: "wash-later",
        eventAt: "2026-10-05T18:00:00.000Z",
        nextDue: day,
      }),
      makeTask(state, {
        id: "wash-paused",
        enabled: false,
        eventAt: "2026-10-05T11:00:00.000Z",
        nextDue: day,
      }),
    );
    const safety = {
      ...defaultSafety(),
      revision: 2,
      dirtySince: "2026-09-28T12:00:00.000Z",
    };
    expect(currentTasks(state, day).length).toBe(3);
    expect(collectDailyReminders(state, safety, now)).toMatchObject({
      day,
      line: "Dnes ešte 1 malý krok.",
      laundry: 1,
      backup: true,
    });
    const items = collectDailyReminders(
      state,
      safety,
      new Date("2026-10-06T12:00:00.000Z"),
    );
    expect(currentTasks(state, "2026-10-06").length).toBe(3);
    expect(items).toMatchObject({
      day: "2026-10-06",
      line: "Dnes ešte 1 malý krok.",
      laundry: 2,
      backup: true,
    });
    expect(JSON.stringify(items)).not.toMatch(/zostáva|týždňa/);
    expect(visibleReminder(items, "home")).toEqual({
      today: true,
      laundry: true,
      backup: true,
    });
    expect(visibleReminder(items, "tasks").laundry).toBe(false);
    expect(visibleReminder(items, "profile").backup).toBe(false);
    expect(
      collectDailyReminders(
        state,
        { ...safety, snoozedUntil: "2026-10-12T12:00:00.000Z" },
        now,
      ).backup,
    ).toBe(false);
    expect(
      collectDailyReminders(fixture(), defaultSafety(), now),
    ).toMatchObject({
      line: "Dnes ešte 1 malý krok.",
      laundry: 0,
      backup: false,
    });
  });
});

describe("dismissing a reminder for the household day", () => {
  it("stores the day and treats another day as still open", () => {
    expect(readReminderDismissed()).toBeNull();
    expect(writeReminderDismissed(day)).toBe(true);
    expect(readReminderDismissed()).toBe(day);
    expect(readReminderDismissed() === "2026-10-06").toBe(false);
  });

  it("keeps showing the reminder when storage cannot be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readReminderDismissed()).toBeNull();
    expect(writeReminderDismissed(day)).toBe(false);
  });
});

describe("DailyReminder", () => {
  const renderReminder = (
    state = fixture(),
    safety = defaultSafety(),
    page = "home",
  ) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const onBackup = vi.fn();
    const onSnoozeWeek = vi.fn();
    const onSnoozeBackup = vi.fn();
    render(
      <DailyReminder
        s={state}
        safety={safety}
        page={page}
        hidden={false}
        onBackup={onBackup}
        onSnoozeWeek={onSnoozeWeek}
        onSnoozeBackup={onSnoozeBackup}
      />,
    );
    return { onBackup, onSnoozeWeek, onSnoozeBackup };
  };

  it("shows today's steps and hides them for the rest of the day", () => {
    renderReminder();
    expect(
      screen.getByRole("status", { name: "Malé pripomenutie" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Dnes ešte 1 malý krok." }),
    ).toHaveAttribute("href", "#/tasks");
    fireEvent.click(screen.getByRole("button", { name: "Dnes nie" }));
    expect(
      screen.queryByRole("status", { name: "Malé pripomenutie" }),
    ).toBeNull();
    expect(readReminderDismissed()).toBe(day);
  });

  it("hides the same day when the app returns to the foreground", () => {
    renderReminder();
    localStorage.setItem("cleanquest-daily-reminder", day);
    expect(
      screen.getByRole("status", { name: "Malé pripomenutie" }),
    ).toBeVisible();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(
      screen.getByRole("status", { name: "Malé pripomenutie" }),
    ).toBeVisible();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(
      screen.queryByRole("status", { name: "Malé pripomenutie" }),
    ).toBeNull();
  });

  it("keeps the laundry line and the weekly backup action", () => {
    const state = fixture();
    state.tasks.push(
      makeTask(state, {
        id: "wash-ready",
        eventAt: "2026-10-05T11:00:00.000Z",
        nextDue: day,
      }),
    );
    const { onBackup, onSnoozeWeek, onSnoozeBackup } = renderReminder(state, {
      ...defaultSafety(),
      revision: 2,
      dirtySince: "2026-09-28T12:00:00.000Z",
    });
    expect(
      screen.getByRole("link", { name: "Pranie má pripravený ďalší krok." }),
    ).toHaveAttribute("href", "#/tasks?tab=laundry");
    expect(screen.getByText(/Od poslednej zálohy/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zálohovať" }));
    fireEvent.click(screen.getByRole("button", { name: "O týždeň" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Zavrieť pripomienku zálohy" }),
    );
    expect(onBackup).toHaveBeenCalledOnce();
    expect(onSnoozeWeek).toHaveBeenCalledOnce();
    expect(onSnoozeBackup).toHaveBeenCalledOnce();
    cleanup();
    render(
      <DailyReminder
        s={state}
        safety={{
          ...defaultSafety(),
          revision: 2,
          dirtySince: "2026-09-28T12:00:00.000Z",
        }}
        page="home"
        hidden={false}
        hideBackup
        onBackup={() => {}}
        onSnoozeWeek={() => {}}
        onSnoozeBackup={() => {}}
      />,
    );
    expect(screen.queryByText(/Od poslednej zálohy/)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Dnes ešte 1 malý krok." }),
    ).toBeVisible();
  });

  it("stays hidden over a dialog and still hides after a failed write", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { rerender } = render(
      <DailyReminder
        s={fixture()}
        safety={defaultSafety()}
        page="home"
        hidden
        onBackup={() => {}}
        onSnoozeWeek={() => {}}
        onSnoozeBackup={() => {}}
      />,
    );
    expect(
      screen.queryByRole("status", { name: "Malé pripomenutie" }),
    ).toBeNull();
    rerender(
      <DailyReminder
        s={fixture()}
        safety={defaultSafety()}
        page="home"
        hidden={false}
        onBackup={() => {}}
        onSnoozeWeek={() => {}}
        onSnoozeBackup={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dnes nie" }));
    expect(
      screen.queryByRole("status", { name: "Malé pripomenutie" }),
    ).toBeNull();
    expect(readReminderDismissed()).toBeNull();
  });
});
