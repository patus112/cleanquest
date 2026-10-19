import {
  useEffect,
  useRef,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
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
}
export type ModalType =
  | { kind: "task"; id?: string; roomId?: string }
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
    ref.current?.showModal();
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
