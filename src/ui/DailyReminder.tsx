import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { State } from "../domain/model";
import type { LocalSafety } from "../domain/localSafety";
import {
  collectDailyReminders,
  laundryLine,
  visibleReminder,
} from "../domain/reminders";
import { Button } from "./components";
import {
  readReminderDismissed,
  writeReminderDismissed,
} from "./reminderDismiss";

export default function DailyReminder({
  s,
  safety,
  page,
  hidden,
  hideBackup = false,
  onBackup,
  onSnoozeWeek,
  onSnoozeBackup,
}: {
  s: State;
  safety: LocalSafety;
  page: string;
  hidden: boolean;
  hideBackup?: boolean;
  onBackup: () => void;
  onSnoozeWeek: () => void;
  onSnoozeBackup: () => void;
}) {
  const [dismissed, setDismissed] = useState(readReminderDismissed);
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      setDismissed(readReminderDismissed());
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  if (hidden) return null;
  const items = collectDailyReminders(s, safety);
  const visible = visibleReminder(items, page);
  const showBackup = visible.backup && !hideBackup;
  if (
    (!visible.today && !visible.laundry && !showBackup) ||
    dismissed === items.day ||
    held === items.day
  )
    return null;
  return (
    <section
      className="notice daily-reminder"
      role="status"
      aria-label="Malé pripomenutie"
    >
      <div>
        <p className="daily-reminder-title">Keď budeš chcieť</p>
        <ul>
          {visible.today && items.line && (
            <li>
              {items.line.startsWith("Dnešný cieľ") ? (
                <span className="today-goal">{items.line}</span>
              ) : (
                <a href="#/tasks">{items.line}</a>
              )}
            </li>
          )}
          {visible.laundry && (
            <li>
              <a href="#/tasks?tab=laundry">{laundryLine(items.laundry)}</a>
            </li>
          )}
          {showBackup && (
            <li className="backup-reminder">
              <span>
                Od poslednej zálohy sa údaje zmenili. Keď budeš chcieť, ulož si
                ich.
              </span>
              <Button variant="secondary compact" onClick={onBackup}>
                Zálohovať
              </Button>
              <Button variant="ghost compact" onClick={onSnoozeWeek}>
                O týždeň
              </Button>
              <Button
                variant="icon ghost"
                aria-label="Zavrieť pripomienku zálohy"
                onClick={onSnoozeBackup}
              >
                <X size={16} />
              </Button>
            </li>
          )}
        </ul>
      </div>
      <Button
        variant="ghost compact"
        onClick={() => {
          writeReminderDismissed(items.day);
          setDismissed(items.day);
          setHeld(items.day);
        }}
      >
        Dnes nie
      </Button>
    </section>
  );
}
