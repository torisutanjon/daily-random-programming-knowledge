const NOTIFY_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseNotifyTime(notifyTime: string): { hours: number; minutes: number } {
  const match = NOTIFY_TIME.exec(notifyTime);
  if (!match) throw new Error(`Invalid notifyTime: ${notifyTime}`);
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
}

export function formatDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The `YYYY-MM-DD` (local) of the word that is current at `now`; days start at `notifyTime`. */
export function currentDayKey(now: Date, notifyTime: string): string {
  assertValidDate(now);
  const { hours, minutes } = parseNotifyTime(notifyTime);
  if (now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes) return formatDayKey(now);
  // Noon, so a DST shift can't push the previous day across a date boundary.
  return formatDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
}

/** The first local `notifyTime` strictly after `now`. */
export function nextFireAt(now: Date, notifyTime: string): Date {
  assertValidDate(now);
  const { hours, minutes } = parseNotifyTime(notifyTime);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (today > now) return today;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
}
