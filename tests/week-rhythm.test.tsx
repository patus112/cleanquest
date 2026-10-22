import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Dashboard from "../src/ui/Dashboard";
import { complete } from "../src/domain/commands";
import { ensurePlans } from "../src/domain/scheduler";
import { fixture } from "./fixture";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("week rhythm previews", () => {
  it("shows done, today and planned tasks with a short overflow count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
    const s = fixture(false);
    s.settings[0].restDays = [0];
    s.settings[0].dailyBudget = 15;
    const floor = s.objects.find((object) => object.category === "floor");
    for (const task of s.tasks)
      task.recurrence = { ...task.recurrence, unit: "day", interval: 1 };
    s.tasks[0].objectId = floor?.id;
    ensurePlans(s, "2026-10-05", "2026-10-05T10:00:00.000Z");
    const mondayPlan = s.dailyPlans.find((plan) => plan.date === "2026-10-05");
    expect(mondayPlan?.occurrences.length).toBeGreaterThan(3);
    const done = mondayPlan!.occurrences.slice(0, 2);
    const skipped = mondayPlan!.occurrences[2];
    for (const occurrence of done)
      complete(
        s,
        occurrence.taskId,
        "required",
        occurrence.id,
        new Date("2026-10-05T10:00:00.000Z"),
      );
    vi.setSystemTime(new Date("2026-10-07T10:00:00.000Z"));
    render(
      <Dashboard
        s={s}
        open={() => {}}
        run={async () => true}
        navigate={() => {}}
      />,
    );

    const monday = screen.getByRole("group", { name: /pondelok/i });
    expect(monday).toHaveAttribute(
      "title",
      expect.stringContaining(done[0].title),
    );
    expect(monday).toHaveAttribute("title", expect.stringContaining("hotové"));
    expect(monday.getAttribute("aria-label")).not.toContain(skipped.title);
    expect(monday.querySelectorAll(".day-task.done")).toHaveLength(2);
    expect(monday.querySelectorAll(".day-task:not(.done)")).toHaveLength(0);
    expect(monday.querySelector(".lucide-layers")).toBeTruthy();
    expect(monday.querySelector(".lucide-sofa")).toBeTruthy();

    const tuesday = screen.getByRole("group", { name: /^utorok$/i });
    expect(tuesday.querySelectorAll(".day-task")).toHaveLength(0);

    const wednesday = screen.getByRole("group", { name: /streda/i });
    expect(wednesday).toHaveClass("today");
    expect(wednesday.getAttribute("aria-label")).toMatch(/dnes/);
    expect(wednesday.querySelectorAll(".day-task")).toHaveLength(3);
    expect(wednesday.querySelectorAll(".day-task.done")).toHaveLength(0);
    expect(within(wednesday).getByText("+2")).toBeVisible();
    const wednesdayNames = wednesday.getAttribute("aria-label") || "";
    expect(wednesdayNames.split(",").length).toBeGreaterThan(3);

    const thursday = screen.getByRole("group", { name: /štvrtok/i });
    expect(thursday.querySelectorAll(".day-task")).toHaveLength(3);
    expect(thursday.querySelector(".day-task.done")).toBeNull();

    const sunday = screen.getByRole("group", { name: /nedeľa/i });
    expect(sunday).toHaveAttribute("aria-label", "Nedeľa, voľno");
    expect(sunday.querySelectorAll(".day-task")).toHaveLength(0);
    expect(sunday.querySelector(".rest")).toBeTruthy();
  });
});
