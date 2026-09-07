import { dayKey, hhmmToMinutes, partsInTz, zonedToUtc } from "./time";
import type { Post, Settings } from "./types";

/** Posts that occupy a slot on the calendar (anything not dead). */
const OCCUPYING = new Set(["draft", "needs_review", "approved", "publishing", "posted"]);

function randInt(min: number, maxInclusive: number) {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

function parseDayKey(key: string) {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Bad date "${key}". Use YYYY-MM-DD.`);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

/** A random time inside one of the posting windows on the given day (workspace timezone). */
export function randomTimeOnDay(key: string, settings: Settings): string {
  const { y, m, d } = parseDayKey(key);
  const w = settings.postingWindows[randInt(0, settings.postingWindows.length - 1)];
  const start = hhmmToMinutes(w.start);
  const end = hhmmToMinutes(w.end);
  const step = settings.randomSchedule.roundToMinutes;
  let minutes = start + randInt(0, Math.max(0, end - start));
  minutes = Math.min(end, Math.round(minutes / step) * step);
  return zonedToUtc(y, m, d, Math.floor(minutes / 60), minutes % 60, settings.timezone).toISOString();
}

/**
 * Pick a random publish time within the next `daysAhead` days (starting tomorrow),
 * inside one of the configured posting windows, avoiding days that are already full
 * and staying `minGapHours` away from other queued posts.
 *
 * Returns an ISO UTC string. Falls back to the least-crowded candidate if every
 * attempt collides, so it never throws for a full calendar.
 */
export function pickRandomSlot(
  existing: Post[],
  settings: Settings,
  now = new Date(),
  exclude?: string,
): string {
  const tz = settings.timezone;
  const { daysAhead, minGapHours, maxPerDay, roundToMinutes } = settings.randomSchedule;
  const windows = settings.postingWindows.map((w) => ({
    start: hhmmToMinutes(w.start),
    end: hhmmToMinutes(w.end),
  }));

  const taken = existing
    .filter((p) => p.id !== exclude && p.scheduledAt && OCCUPYING.has(p.status))
    .map((p) => ({ t: Date.parse(p.scheduledAt!), day: dayKey(p.scheduledAt!, tz) }));

  const perDay = new Map<string, number>();
  for (const t of taken) perDay.set(t.day, (perDay.get(t.day) ?? 0) + 1);

  // Candidate days: tomorrow .. tomorrow + daysAhead - 1, in the configured zone.
  const today = partsInTz(now, tz);
  const days: { y: number; m: number; d: number; key: string }[] = [];
  for (let i = 1; i <= daysAhead; i++) {
    const utcMidnight = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12));
    const p = partsInTz(utcMidnight, tz);
    const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    days.push({ y: p.year, m: p.month, d: p.day, key });
  }

  const openDays = days.filter((d) => (perDay.get(d.key) ?? 0) < maxPerDay);
  const pool = openDays.length ? openDays : days;

  const gapMs = minGapHours * 3600_000;
  let best: { iso: string; score: number } | null = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const day = pool[randInt(0, pool.length - 1)];
    const w = windows[randInt(0, windows.length - 1)];
    const span = Math.max(0, w.end - w.start);
    let minutes = w.start + randInt(0, span);
    minutes = Math.round(minutes / roundToMinutes) * roundToMinutes;
    minutes = Math.min(minutes, w.end);
    const when = zonedToUtc(day.y, day.m, day.d, Math.floor(minutes / 60), minutes % 60, tz);
    if (when.getTime() <= now.getTime() + 15 * 60_000) continue;

    const nearest = taken.reduce(
      (min, t) => Math.min(min, Math.abs(t.t - when.getTime())),
      Number.POSITIVE_INFINITY,
    );
    if (nearest >= gapMs) return when.toISOString();
    if (!best || nearest > best.score) best = { iso: when.toISOString(), score: nearest };
  }

  if (best) return best.iso;
  // Degenerate config (e.g. windows all in the past today); push to tomorrow noon.
  const t = days[0];
  return zonedToUtc(t.y, t.m, t.d, 12, 0, tz).toISOString();
}
