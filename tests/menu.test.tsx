import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Button, OverflowMenu } from "../src/ui/components";
import Tasks from "../src/ui/Tasks";
import { fixture, now } from "./fixture";

afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function rect(partial: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON() {
      return {};
    },
    ...partial,
  };
}

function menuTrigger(name: string) {
  return screen.getByRole("button", { name });
}

describe("overflow menu", () => {
  it("exposes menu semantics and closes on every requested path", () => {
    const choose = vi.fn();
    render(
      <>
        <OverflowMenu label="Možnosti: prvá">
          <Button onClick={choose}>Vynechať dnes</Button>
          <Button>Odložiť na zajtra</Button>
        </OverflowMenu>
        <OverflowMenu label="Možnosti: druhá">
          <Button>Ukázať miesto</Button>
        </OverflowMenu>
        <button type="button">Mimo</button>
      </>,
    );
    const first = menuTrigger("Možnosti: prvá");
    const second = menuTrigger("Možnosti: druhá");
    expect(first).toHaveAttribute("aria-haspopup", "menu");
    expect(first).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(first);
    const skip = screen.getByRole("menuitem", { name: "Vynechať dnes" });
    const later = screen.getByRole("menuitem", { name: "Odložiť na zajtra" });
    expect(screen.getByRole("menu", { name: "Možnosti: prvá" })).toBeVisible();
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(skip).toHaveFocus();

    fireEvent.keyDown(skip, { key: "ArrowDown" });
    expect(later).toHaveFocus();
    fireEvent.keyDown(later, { key: "ArrowUp" });
    expect(skip).toHaveFocus();

    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeVisible();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(first).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(first);
    fireEvent.click(first);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(first);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(first).toHaveFocus();

    fireEvent.click(first);
    fireEvent.click(screen.getByRole("menuitem", { name: "Vynechať dnes" }));
    expect(choose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(first);
    fireEvent.click(second);
    expect(
      screen.queryByRole("menuitem", { name: "Vynechať dnes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Ukázať miesto" }),
    ).toBeVisible();
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");

    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("flips upward when the menu would leave the viewport", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "menu" ? 280 : 0;
      },
    );
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute("role") === "menu")
          return rect({ height: 280, bottom: 280, width: 210, right: 210 });
        if (this.classList.contains("task-menu-trigger"))
          return rect({
            top: 700,
            bottom: 744,
            left: 300,
            right: 344,
            width: 44,
            height: 44,
            x: 300,
            y: 700,
          });
        return rect({});
      });
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    render(
      <OverflowMenu label="Možnosti: dolu">
        <Button>Vynechať dnes</Button>
      </OverflowMenu>,
    );
    fireEvent.click(menuTrigger("Možnosti: dolu"));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toHaveClass("flip");
    expect(menu).toHaveStyle({ maxHeight: "692px" });
    spy.mockRestore();
    vi.restoreAllMocks();
  });

  it("closes the today plan menu when the tab changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(<Tasks s={fixture()} run={async () => true} open={vi.fn()} />);
    const triggers = screen.getAllByRole("button", { name: /^Možnosti:/ });
    expect(triggers.length).toBeGreaterThan(1);
    fireEvent.click(triggers[0]);
    expect(
      screen.getByRole("menuitem", { name: "Vynechať dnes" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Odložiť na zajtra" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Miestnosti" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Vynechať dnes" }),
    ).not.toBeInTheDocument();
  });
});
