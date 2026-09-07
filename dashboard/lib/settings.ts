import { promises as fs } from "node:fs";
import { SETTINGS_FILE } from "./paths";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  timezone: "Asia/Kolkata",
  postingWindows: [
    { start: "11:00", end: "13:30" },
    { start: "18:00", end: "21:00" },
  ],
  randomSchedule: { daysAhead: 7, minGapHours: 20, maxPerDay: 1, roundToMinutes: 5 },
  instagram: { shareToFeed: true, defaultHashtags: [] },
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      randomSchedule: { ...DEFAULT_SETTINGS.randomSchedule, ...(raw.randomSchedule ?? {}) },
      instagram: { ...DEFAULT_SETTINGS.instagram, ...(raw.instagram ?? {}) },
      postingWindows: raw.postingWindows?.length
        ? raw.postingWindows
        : DEFAULT_SETTINGS.postingWindows,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_SETTINGS;
    throw err;
  }
}
