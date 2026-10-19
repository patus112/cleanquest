import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import UpdateNotice from "../src/ui/UpdateNotice";
afterEach(() => {
  cleanup();
});
describe("update notice", () => {
  const props = {
    busy: false,
    preparing: false,
    onUpdate: vi.fn(),
    onBackup: vi.fn(),
    onDismiss: vi.fn(),
  };
  it("offers the existing backup before an update when data is unbacked, and skip still updates", () => {
    const onUpdate = vi.fn(),
      onBackup = vi.fn();
    render(
      <UpdateNotice
        {...props}
        needRefresh
        offlineReady={false}
        unbacked
        onUpdate={onUpdate}
        onBackup={onBackup}
      />,
    );
    expect(
      screen.getByText(/Od poslednej zálohy sa údaje zmenili/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Uložiť zálohu" }));
    expect(onBackup).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Aktualizovať aj tak" }),
    );
    expect(onUpdate).toHaveBeenCalledOnce();
  });
  it("updates immediately when the last backup is already confirmed", () => {
    const onUpdate = vi.fn(),
      onBackup = vi.fn();
    render(
      <UpdateNotice
        {...props}
        needRefresh
        offlineReady={false}
        unbacked={false}
        onUpdate={onUpdate}
        onBackup={onBackup}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Uložiť zálohu" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aktualizovať" }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onBackup).not.toHaveBeenCalled();
  });
  it("keeps the offline-ready note free of an update action", () => {
    render(
      <UpdateNotice {...props} needRefresh={false} offlineReady unbacked />,
    );
    expect(screen.getByText(/bez internetu/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Aktualizovať/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Uložiť zálohu" }),
    ).not.toBeInTheDocument();
  });
});
