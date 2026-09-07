/**
 * Timezone helpers built on Intl only, so they run in both the browser and Node.
 * All stored timestamps are ISO 8601 UTC; these convert to/from the configured zone.
 */

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function partsInTz(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const part of dtf(tz).formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour === 24 ? 0 : +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

/** Offset (ms) of `tz` from UTC at the given instant. Positive east of UTC. */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Build the UTC instant for a wall-clock time in `tz`. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const off1 = tzOffsetMs(new Date(guess), tz);
  const candidate = guess - off1;
  // Re-check in case the guess straddled a DST change.
  const off2 = tzOffsetMs(new Date(candidate), tz);
  return new Date(off1 === off2 ? candidate : guess - off2);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of an instant in `tz`. */
export function dayKey(iso: string | Date, tz: string): string {
  const p = partsInTz(typeof iso === "string" ? new Date(iso) : iso, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Value for <input type="datetime-local"> showing the instant in `tz`. */
export function toDateTimeInput(iso: string, tz: string): string {
  const p = partsInTz(new Date(iso), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parse a "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD HH:mm") wall-clock string in `tz` to ISO UTC. */
export function fromDateTimeInput(value: string, tz: string): string {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) throw new Error(`Bad date-time "${value}". Use YYYY-MM-DD HH:mm.`);
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz).toISOString();
}

/** Human-friendly "Tue, Sep 8 · 6:30 PM" in `tz`. */
export function formatInTz(iso: string, tz: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(", ", ", ")
    .replace(/, (\d{1,2}:\d{2})/, " · $1");
}

export function formatTimeInTz(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Parse "HH:mm" → minutes since midnight. */
export function hhmmToMinutes(s: string): number {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad time "${s}". Use HH:mm.`);
  return +m[1] * 60 + +m[2];
}

export function isFuture(iso: string, marginMs = 2 * 60 * 1000): boolean {
  return new Date(iso).getTime() > Date.now() + marginMs;
}
