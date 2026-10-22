import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useState,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { X, ArrowRight, type LucideIcon } from "lucide-react";
import type { State } from "../domain/model";
import { optimizePhoto } from "../persistence/photos";
import { TidyKit } from "./art";
export interface ScreenProps {
  sessionBudget?: number;
  s: State;
  run: (recipe: (s: State) => void, message?: string) => Promise<boolean>;
  open: (modal: ModalType) => void;
  reminder?: ReactNode;
}
export type ModalType =
  | { kind: "task"; id?: string; roomId?: string }
  | { kind: "quick" }
  | { kind: "room"; id?: string }
  | { kind: "object"; id?: string; roomId: string }
  | { kind: "layout"; roomId: string }
  | { kind: "move-object"; id: string }
  | { kind: "problem"; id?: string }
  | { kind: "household" }
  | { kind: "redeem"; wishId?: string }
  | { kind: "wish"; id?: string }
  | { kind: "focus" }
  | { kind: "location"; taskId: string; occurrenceId?: string }
  | { kind: "split"; id: string }
  | {
      kind: "delete";
      entity: "task" | "room" | "object" | "problem" | "floor" | "wish";
      id: string;
    }
  | null;
export function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
  className?: string;
  role?: string;
}) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`button ${variant} ${rest.className || ""}`}
    >
      {children}
    </button>
  );
}
const MENU_EVENT = "cleanquest-menu";
function menuItems(children: ReactNode) {
  return Children.map(children, (child) =>
    isValidElement(child)
      ? cloneElement(child as ReactElement<{ role?: string }>, {
          role: "menuitem",
        })
      : child,
  );
}
export function OverflowMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const nav = document.querySelector(".bottom-nav");
    const navHeight =
      nav && getComputedStyle(nav).display !== "none"
        ? nav.getBoundingClientRect().height
        : 0;
    const gap = 8;
    const spaceBelow = window.innerHeight - navHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const needed =
      (menu.scrollHeight || menu.getBoundingClientRect().height) + 2;
    const nextFlip = spaceBelow < needed && spaceAbove > spaceBelow;
    const available = nextFlip ? spaceAbove : spaceBelow;
    setFlip((current) => (current === nextFlip ? current : nextFlip));
    setMaxHeight((current) => {
      const next = Math.max(0, Math.floor(available));
      return current === next ? current : next;
    });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      "[role='menuitem']:not(:disabled)",
    );
    items?.[0]?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const onHash = () => setOpen(false);
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== menuId) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    window.addEventListener(MENU_EVENT, onOther);
    window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: menuId }));
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(MENU_EVENT, onOther);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, menuId, place]);
  const onMenuKey = (event: ReactKeyboardEvent) => {
    if (!open) return;
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>(
        "[role='menuitem']:not(:disabled)",
      ) ?? []),
    ];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index <= 0 ? items.length : index) - 1]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };
  return (
    <div
      ref={rootRef}
      className={`task-actions${open ? " open" : ""}${open && flip ? " flip" : ""}`}
      onKeyDown={onMenuKey}
    >
      <button
        ref={triggerRef}
        type="button"
        className="task-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        •••
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          style={maxHeight != null ? { maxHeight } : undefined}
          onClick={(event) => {
            const node = event.target as Node | null;
            const target = node instanceof Element ? node : node?.parentElement;
            if (target?.closest("[role='menuitem']")) setOpen(false);
          }}
        >
          {menuItems(children)}
        </div>
      )}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const focusInside = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active !== dialog &&
        dialog.contains(active)
      )
        return;
      const field = dialog.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file']), select, textarea, button",
      );
      (field ?? dialog).focus({ preventScroll: true });
    };
    focusInside();
    const onFocusIn = (event: FocusEvent) => {
      if (!dialog.isConnected || !dialog.open) return;
      if (!(event.target instanceof Node) || dialog.contains(event.target))
        return;
      focusInside();
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);
  return (
    <dialog
      className={footer ? "dialog-with-footer" : undefined}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <Button variant="icon ghost" onClick={onClose} aria-label="Zavrieť">
          <X size={20} />
        </Button>
      </div>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(child.type as string)
          ? cloneElement(
              child as ReactElement<{
                id?: string;
                "aria-describedby"?: string;
              }>,
              { id, "aria-describedby": hint ? `${id}-hint` : undefined },
            )
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  art,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        {art ?? <TidyKit />}
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="section-label">
      <span className="section-badge" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="eyebrow">{children}</span>
    </span>
  );
}
export function PageHead({
  eyebrow,
  title,
  text,
  action,
  art,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  action?: ReactNode;
  art?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <span className="page-kicker">
          {Icon ? (
            <span className="section-badge" aria-hidden="true">
              <Icon size={16} strokeWidth={1.75} />
            </span>
          ) : null}
          <span className="eyebrow">{eyebrow}</span>
        </span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {art ? (
        <div className="page-art" aria-hidden="true">
          {art}
        </div>
      ) : null}
      {action}
    </header>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && (
        <div className="progress-label">
          {label}
          <span>{Math.round(value * 100)} %</span>
        </div>
      )}
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Pokrok"}
      >
        <i style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  );
}
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <span className="logo-mark">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          className="logo-leaf"
          d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
        />
        <path
          className="logo-vein"
          d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
        />
      </svg>
    </span>
  );
}
export function LinkAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="link-action" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
export function PhotoInput({
  name = "photo",
  value,
}: {
  name?: string;
  value?: string;
}) {
  return (
    <Field
      label="Fotografia (voliteľné, do 20 MB)"
      hint="Pred uložením ju zmenšíme, aby šetrila miesto v zariadení."
    >
      <input type="file" name={name} accept="image/png,image/jpeg,image/webp" />
      {value && (
        <img className="photo" src={value} alt="Priložená fotografia" />
      )}
    </Field>
  );
}
export async function photoFrom(
  fd: FormData,
  name = "photo",
  existing?: string,
): Promise<string | undefined> {
  const file = fd.get(name);
  if (!(file instanceof File) || !file.size) return existing;
  return optimizePhoto(file);
}
export const str = (f: FormData, k: string) => String(f.get(k) || "").trim();
export const num = (f: FormData, k: string) => Number(f.get(k) || 0);
