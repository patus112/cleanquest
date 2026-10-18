import { useEffect, useState } from "react";
import type { State } from "../domain/model";
import type { LocalSafety } from "../domain/localSafety";
import {
  collectDailyReminders,
  laundryLine,
  overdueLine,
  questLine,
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
  onBackup,
  onSnoozeWeek,
}: {
  s: State;
  safety: LocalSafety;
  page: string;
  hidden: boolean;
  onBackup: () => void;
  onSnoozeWeek: () => void;
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
  if (
    (!visible.steps && !visible.laundry && !visible.backup) ||
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
          {visible.steps && (
            <li>
              <a href="#/tasks">{questLine(items.steps)}</a>
              {items.overdue > 0 && (
                <span className="overdue">{overdueLine(items.overdue)}</span>
              )}
            </li>
          )}
          {visible.laundry && (
            <li>
              <a href="#/tasks?tab=laundry">{laundryLine(items.laundry)}</a>
            </li>
          )}
          {visible.backup && (
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
