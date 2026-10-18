const KEY = "cleanquest-daily-reminder";

export function readReminderDismissed() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeReminderDismissed(day: string) {
  try {
    localStorage.setItem(KEY, day);
    return true;
  } catch {
    return false;
  }
}
