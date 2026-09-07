import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { NotFoundError } from "./errors";
import { DATA_DIR, POSTS_FILE } from "./paths";
import type { HistoryEntry, Post } from "./types";

type Db = { posts: Post[] };

/**
 * Tiny JSON-file store. Single-user, so a process-local write lock plus
 * atomic rename is enough. Every mutation goes through `mutate`.
 */

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(POSTS_FILE, "utf8");
    const db = JSON.parse(raw) as Partial<Db>;
    return { posts: Array.isArray(db.posts) ? db.posts : [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { posts: [] };
    throw err;
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `.posts.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + "\n", "utf8");
  await fs.rename(tmp, POSTS_FILE);
}

export function newPostId(date = new Date()): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${d}-${randomBytes(3).toString("hex")}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export async function listPosts(): Promise<Post[]> {
  const { posts } = await readDb();
  return posts.sort(sortBySchedule);
}

export async function getPost(id: string): Promise<Post | undefined> {
  const { posts } = await readDb();
  return posts.find((p) => p.id === id);
}

export async function insertPost(post: Post): Promise<Post> {
  return withLock(async () => {
    const db = await readDb();
    if (db.posts.some((p) => p.id === post.id)) {
      throw new Error(`Post ${post.id} already exists`);
    }
    db.posts.push(post);
    await writeDb(db);
    return post;
  });
}

/**
 * Apply `updater` to a post and persist. The updater may mutate the draft in place
 * or return a replacement. `updatedAt` is stamped automatically.
 */
export async function mutatePost(
  id: string,
  updater: (draft: Post) => Post | void | Promise<Post | void>,
): Promise<Post> {
  return withLock(async () => {
    const db = await readDb();
    const idx = db.posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundError(`Post ${id} not found`);
    const draft: Post = structuredClone(db.posts[idx]);
    const result = (await updater(draft)) ?? draft;
    result.updatedAt = nowIso();
    db.posts[idx] = result;
    await writeDb(db);
    return result;
  });
}

export async function removePost(id: string): Promise<Post | undefined> {
  return withLock(async () => {
    const db = await readDb();
    const idx = db.posts.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    const [removed] = db.posts.splice(idx, 1);
    await writeDb(db);
    return removed;
  });
}

export function addHistory(post: Post, event: string, detail?: string): HistoryEntry {
  const entry: HistoryEntry = { at: nowIso(), event, ...(detail ? { detail } : {}) };
  post.history = [...(post.history ?? []), entry].slice(-50);
  return entry;
}



function sortBySchedule(a: Post, b: Post) {
  const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER;
  const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER;
  if (ta !== tb) return ta - tb;
  return a.createdAt.localeCompare(b.createdAt);
}
