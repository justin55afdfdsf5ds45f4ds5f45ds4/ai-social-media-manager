import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { NotFoundError, UserError } from "./errors";
import { postDir, POSTS_DIR } from "./paths";
import { pickRandomSlot, randomTimeOnDay } from "./scheduler";
import { loadSettings } from "./settings";
import { addHistory, getPost, insertPost, listPosts, mutatePost, newPostId, nowIso } from "./store";
import { fromDateTimeInput } from "./time";
import type { CreateDraftInput, MediaKind, Post, PostMedia, ScheduleSource } from "./types";

const execFileP = promisify(execFile);

const VIDEO_EXT = [".mp4", ".mov"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png"];

/** Statuses in which the media or text may still be changed locally. */
const EDITABLE = new Set(["draft", "needs_review", "rejected", "failed"]);

// ---------------------------------------------------------------------------
// Probing / validation
// ---------------------------------------------------------------------------

export async function probeVideo(file: string): Promise<Partial<PostMedia>> {
  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      file,
    ]);
    const j = JSON.parse(stdout) as {
      streams?: { width?: number; height?: number }[];
      format?: { duration?: string };
    };
    const s = j.streams?.[0] ?? {};
    return {
      width: s.width,
      height: s.height,
      durationSec: j.format?.duration ? Math.round(parseFloat(j.format.duration) * 10) / 10 : undefined,
    };
  } catch {
    return {}; // ffprobe missing or unreadable file: metadata is optional
  }
}

function validateMedia(m: Partial<PostMedia>, sizeBytes: number) {
  const problems: string[] = [];
  if (sizeBytes > 300 * 1024 * 1024) problems.push("file is over Instagram's 300 MB limit");
  if (m.durationSec !== undefined && m.durationSec < 3) problems.push("shorter than 3 seconds");
  if (m.durationSec !== undefined && m.durationSec > 15 * 60) problems.push("longer than 15 minutes");
  if (m.width && m.height) {
    const ratio = m.width / m.height;
    // Reels: 9:16 ideal. Blotato accepts 4:5 .. 1.91:1 and 9:16.
    const ok = Math.abs(ratio - 9 / 16) < 0.02 || (ratio >= 0.8 - 0.01 && ratio <= 1.91 + 0.01);
    if (!ok) problems.push(`aspect ratio ${m.width}x${m.height} is not 9:16 (or 4:5..1.91:1)`);
  }
  if (problems.length) throw new UserError(`Video rejected: ${problems.join("; ")}.`);
}

async function inspectVideo(src: string) {
  const ext = path.extname(src).toLowerCase();
  if (!VIDEO_EXT.includes(ext)) throw new UserError(`Unsupported video type "${ext}". Export an H.264 .mp4.`);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat?.isFile()) throw new UserError(`Video not found: ${src}`);
  const probe = await probeVideo(src);
  validateMedia(probe, stat.size);
  return { ext, stat, probe };
}

// ---------------------------------------------------------------------------
// Planned slots (created from the calendar)
// ---------------------------------------------------------------------------

/** Create an empty, planned post on a day. The AI (or an upload) fills it later. */
export async function createDraft(input: Omit<CreateDraftInput, "kind">): Promise<Post> {
  const settings = await loadSettings();
  let scheduledAt: string;
  let scheduleSource: ScheduleSource = "manual";
  if (input.scheduledAt) {
    scheduledAt = new Date(input.scheduledAt).toISOString();
  } else if (input.date) {
    scheduledAt = randomTimeOnDay(input.date, settings);
  } else {
    scheduledAt = pickRandomSlot(await listPosts(), settings);
    scheduleSource = "random";
  }
  if (Number.isNaN(Date.parse(scheduledAt))) throw new UserError("Invalid date.");

  const id = newPostId();
  await fs.mkdir(postDir(id), { recursive: true });
  const post: Post = {
    id,
    title: input.title?.trim() ?? "",
    caption: "",
    scheduledAt,
    scheduleSource,
    status: "draft",
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [],
  };
  addHistory(post, "planned", scheduledAt);
  await writeSidecar(post);
  return insertPost(post);
}

// ---------------------------------------------------------------------------
// Media attach / remove
// ---------------------------------------------------------------------------

export type AttachInput = {
  kind: MediaKind;
  /** Path to the source file. */
  srcPath: string;
  /** Move instead of copy (used for uploads that already live in a temp file). */
  move?: boolean;
};

/**
 * Attach (or replace) the reel or the cover of an existing post. Copies the file into
 * content/posts/<id>/ and, for a reel on a planned slot, moves the post into review.
 */
export async function attachMedia(id: string, input: AttachInput): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  if (!EDITABLE.has(post.status)) {
    throw new UserError(`Cannot change media while the post is ${post.status}. Cancel the schedule first.`);
  }
  const dir = postDir(id);
  await fs.mkdir(dir, { recursive: true });

  if (input.kind === "video") {
    const { ext, stat, probe } = await inspectVideo(input.srcPath);
    const name = `reel${ext}`;
    if (post.media?.video && post.media.video !== name) {
      await fs.rm(path.join(dir, post.media.video), { force: true });
    }
    await placeFile(input.srcPath, path.join(dir, name), input.move);
    const updated = await mutatePost(id, (d) => {
      d.media = { video: name, cover: d.media?.cover, sizeBytes: stat.size, ...probe };
      if (d.blotato) d.blotato = { ...d.blotato, mediaUrl: undefined }; // must re-upload
      if (d.status === "draft") d.status = "needs_review";
      addHistory(d, "reel_attached", `${name} · ${(stat.size / 1048576).toFixed(1)} MB`);
    });
    await writeSidecar(updated);
    return updated;
  }

  const cext = path.extname(input.srcPath).toLowerCase();
  if (!IMAGE_EXT.includes(cext)) throw new UserError("Cover must be JPG or PNG.");
  const cstat = await fs.stat(input.srcPath).catch(() => null);
  if (!cstat?.isFile()) throw new UserError(`Cover not found: ${input.srcPath}`);
  if (cstat.size > 8 * 1024 * 1024) throw new UserError("Cover is over Instagram's 8 MB limit.");
  if (!post.media) throw new UserError("Attach the reel before adding a cover.");
  const cname = `cover${cext}`;
  if (post.media.cover && post.media.cover !== cname) {
    await fs.rm(path.join(dir, post.media.cover), { force: true });
  }
  await placeFile(input.srcPath, path.join(dir, cname), input.move);
  return mutatePost(id, (d) => {
    d.media = { ...d.media!, cover: cname };
    if (d.blotato) d.blotato = { ...d.blotato, coverUrl: undefined };
    addHistory(d, "cover_attached", cname);
  });
}

/** Remove the reel (post goes back to planned) or just the cover. */
export async function removeMedia(id: string, kind: MediaKind): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  if (!EDITABLE.has(post.status)) {
    throw new UserError(`Cannot remove media while the post is ${post.status}.`);
  }
  if (!post.media) return post;
  const dir = postDir(id);
  if (kind === "video") {
    await fs.rm(path.join(dir, post.media.video), { force: true });
    if (post.media.cover) await fs.rm(path.join(dir, post.media.cover), { force: true });
    const updated = await mutatePost(id, (d) => {
      d.media = undefined;
      if (d.blotato) d.blotato = { ...d.blotato, mediaUrl: undefined, coverUrl: undefined };
      if (d.status === "needs_review") d.status = "draft";
      addHistory(d, "reel_removed");
    });
    await writeSidecar(updated);
    return updated;
  }
  if (post.media.cover) await fs.rm(path.join(dir, post.media.cover), { force: true });
  return mutatePost(id, (d) => {
    d.media = { ...d.media!, cover: undefined };
    if (d.blotato) d.blotato = { ...d.blotato, coverUrl: undefined };
    addHistory(d, "cover_removed");
  });
}

// ---------------------------------------------------------------------------
// CLI / API submit
// ---------------------------------------------------------------------------

export type SubmitInput = {
  /** Absolute or cwd-relative path to the finished reel (H.264 MP4). */
  videoPath: string;
  /** Required for a new post; optional when filling an existing planned slot. */
  caption?: string;
  title?: string;
  firstComment?: string;
  coverPath?: string;
  notes?: string;
  /**
   * "random"           → random slot in the next week (default)
   * "asap"             → schedule for now (still needs approval / Post now)
   * ISO string, or "YYYY-MM-DD HH:mm" interpreted in the configured timezone
   */
  schedule?: "random" | "asap" | string;
  /** Move instead of copy the source video into content/posts/<id>/ */
  move?: boolean;
  /** Fill an existing planned slot instead of creating a new post. */
  into?: string;
};

/**
 * Add a finished reel to the review queue. Creates a new post, or fills a planned
 * slot when `into` is given. Media is copied into content/posts/<id>/.
 */
export async function submitReel(input: SubmitInput): Promise<Post> {
  const settings = await loadSettings();
  const src = path.resolve(input.videoPath);
  await inspectVideo(src); // fail fast before touching the store

  const caption = input.caption?.trim();
  if (caption && caption.length > 2200) throw new UserError("Caption is over 2200 characters.");

  if (input.into) {
    const target = await getPost(input.into);
    if (!target) throw new NotFoundError(`Post ${input.into} not found`);
    if (!caption && !target.caption.trim()) throw new UserError("Caption is required (the slot has none yet).");
    await attachMedia(target.id, { kind: "video", srcPath: src, move: input.move });
    if (input.coverPath) {
      await attachMedia(target.id, { kind: "cover", srcPath: path.resolve(input.coverPath), move: input.move });
    }
    const updated = await mutatePost(target.id, (d) => {
      if (caption) d.caption = caption;
      if (input.title?.trim()) d.title = input.title.trim();
      if (!d.title) d.title = titleFrom(d.caption, d.id);
      if (input.firstComment !== undefined) d.firstComment = input.firstComment.trim() || undefined;
      if (input.notes?.trim()) d.notes = [d.notes, input.notes.trim()].filter(Boolean).join("\n\n");
      if (input.schedule && input.schedule !== "random") {
        const s = resolveSchedule(input.schedule, settings.timezone);
        d.scheduledAt = s.scheduledAt;
        d.scheduleSource = s.scheduleSource;
      }
      addHistory(d, "submitted", "filled planned slot");
    });
    await writeSidecar(updated);
    return updated;
  }

  if (!caption) throw new UserError("Caption is required.");

  const id = newPostId();
  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(postDir(id), { recursive: true });

  const sched = input.schedule ?? "random";
  const { scheduledAt, scheduleSource } =
    sched === "random"
      ? { scheduledAt: pickRandomSlot(await listPosts(), settings), scheduleSource: "random" as const }
      : resolveSchedule(sched, settings.timezone);

  const post: Post = {
    id,
    title: input.title?.trim() || titleFrom(caption, id),
    caption,
    firstComment: input.firstComment?.trim() || undefined,
    scheduledAt,
    scheduleSource,
    status: "draft",
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [],
  };
  addHistory(post, "submitted", `${scheduleSource} → ${scheduledAt}`);
  await insertPost(post);

  // attachMedia flips draft → needs_review and writes the sidecar.
  let result = await attachMedia(id, { kind: "video", srcPath: src, move: input.move });
  if (input.coverPath) {
    result = await attachMedia(id, { kind: "cover", srcPath: path.resolve(input.coverPath), move: input.move });
  }
  return result;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function resolveSchedule(sched: string, tz: string): { scheduledAt: string; scheduleSource: ScheduleSource } {
  if (sched === "asap") return { scheduledAt: nowIso(), scheduleSource: "asap" };
  const iso = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/.test(sched)
    ? fromDateTimeInput(sched, tz)
    : new Date(sched).toISOString();
  if (Number.isNaN(Date.parse(iso))) throw new UserError(`Bad schedule "${sched}".`);
  return { scheduledAt: iso, scheduleSource: "manual" };
}

function titleFrom(caption: string, id: string) {
  return caption.split("\n")[0].replace(/[#@]\S+/g, "").trim().slice(0, 60) || `Reel ${id}`;
}

/** Human-readable copy next to the media, for the AI and for manual inspection. */
async function writeSidecar(post: Post) {
  await fs.mkdir(postDir(post.id), { recursive: true });
  await fs.writeFile(
    path.join(postDir(post.id), "post.json"),
    JSON.stringify(
      {
        id: post.id,
        status: post.status,
        title: post.title,
        caption: post.caption,
        firstComment: post.firstComment,
        notes: post.notes,
        scheduledAt: post.scheduledAt,
        media: post.media,
      },
      null,
      2,
    ),
  );
}

async function placeFile(src: string, dest: string, move?: boolean) {
  if (path.resolve(src) === path.resolve(dest)) return;
  if (move) {
    try {
      await fs.rename(src, dest);
      return;
    } catch {
      /* cross-device: fall through to copy + unlink */
    }
    await fs.copyFile(src, dest);
    await fs.unlink(src);
  } else {
    await fs.copyFile(src, dest);
  }
}
