import path from "node:path";
import { blotato, BlotatoError, type PostPayload } from "./blotato";
import { NotFoundError, UserError } from "./errors";
import { postDir, requireEnv } from "./paths";
import { pickRandomSlot } from "./scheduler";
import { loadSettings } from "./settings";
import { addHistory, getPost, listPosts, mutatePost } from "./store";
import { isFuture } from "./time";
import type { Post, PostPatch, Settings } from "./types";

/**
 * Everything that moves a post between the local queue and Blotato lives here.
 * Routes and CLI scripts call these; nothing else talks to Blotato directly.
 */

const APPROVABLE = new Set(["draft", "needs_review", "failed", "rejected"]);

function buildPayload(post: Post, settings: Settings): PostPayload {
  const accountId = post.blotato?.accountId ?? requireEnv("INSTAGRAM_ACCOUNT_ID");
  if (!post.blotato?.mediaUrl) throw new Error("Media not uploaded yet");
  const text = post.caption.trim();
  if (!text) throw new UserError("Write a caption first.");
  if (text.length > 2200) throw new UserError("Caption is over Instagram's 2200 character limit.");
  return {
    accountId,
    content: { text, mediaUrls: [post.blotato.mediaUrl], platform: "instagram" },
    target: {
      targetType: "instagram",
      mediaType: "reel",
      shareToFeed: settings.instagram.shareToFeed,
      ...(post.blotato.coverUrl ? { coverImageUrl: post.blotato.coverUrl } : {}),
      ...(post.firstComment?.trim() ? { firstComment: post.firstComment.trim() } : {}),
    },
  };
}

/** Upload the reel (and cover, if any) once; URLs are cached on the post. */
async function ensureUploaded(id: string): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  if (!post.media) throw new UserError("Attach a reel first. This slot has no video yet.");
  const accountId = post.blotato?.accountId ?? requireEnv("INSTAGRAM_ACCOUNT_ID");
  let mediaUrl = post.blotato?.mediaUrl;
  let coverUrl = post.blotato?.coverUrl;

  if (!mediaUrl) {
    mediaUrl = await blotato.uploadFile(
      path.join(postDir(id), post.media.video),
      `${id}-${post.media.video}`,
    );
  }
  if (!coverUrl && post.media.cover) {
    coverUrl = await blotato.uploadFile(
      path.join(postDir(id), post.media.cover),
      `${id}-${post.media.cover}`,
    );
  }
  return mutatePost(id, (d) => {
    d.blotato = { ...(d.blotato ?? { accountId }), accountId, mediaUrl, coverUrl };
    addHistory(d, "media_uploaded", mediaUrl);
  });
}

/** Approve: schedule on Blotato for `scheduledAt`. Blotato does the posting later. */
export async function approve(id: string): Promise<Post> {
  const existing = await getPost(id);
  if (!existing) throw new NotFoundError(`Post ${id} not found`);
  if (!APPROVABLE.has(existing.status)) throw new UserError(`Post is already ${existing.status}.`);
  if (!existing.scheduledAt) throw new UserError("Set a schedule time first, or use Post now.");
  if (!isFuture(existing.scheduledAt)) {
    throw new UserError("The scheduled time is in the past. Pick a new time or use Post now.");
  }

  const settings = await loadSettings();
  const post = await ensureUploaded(id);
  const payload = buildPayload(post, settings);
  const res = await blotato.createPost(payload, post.scheduledAt!);

  const scheduleId = await findScheduleId(post.blotato!.mediaUrl!, res.scheduledTime ?? post.scheduledAt!);

  return mutatePost(id, (d) => {
    d.status = "approved";
    d.blotato = {
      ...d.blotato!,
      postSubmissionId: res.postSubmissionId,
      scheduleId,
      remoteStatus: "scheduled",
      errorMessage: undefined,
      lastSyncAt: new Date().toISOString(),
    };
    if (res.scheduledTime) d.scheduledAt = new Date(res.scheduledTime).toISOString();
    addHistory(d, "approved", `Scheduled on Blotato (${res.postSubmissionId})`);
  });
}

/** Post now: publish immediately and poll briefly for the result. */
export async function publishNow(id: string): Promise<Post> {
  const existing = await getPost(id);
  if (!existing) throw new NotFoundError(`Post ${id} not found`);
  if (existing.status === "posted" || existing.status === "publishing") {
    throw new UserError(`Post is already ${existing.status}.`);
  }
  if (existing.status === "approved") await cancelRemote(id, false);

  const settings = await loadSettings();
  const post = await ensureUploaded(id);
  const payload = buildPayload(post, settings);
  const res = await blotato.createPost(payload);

  await mutatePost(id, (d) => {
    d.status = "publishing";
    d.scheduledAt = new Date().toISOString();
    d.scheduleSource = "asap";
    d.blotato = {
      ...d.blotato!,
      postSubmissionId: res.postSubmissionId,
      scheduleId: undefined,
      remoteStatus: "in-progress",
      errorMessage: undefined,
    };
    addHistory(d, "publish_now", res.postSubmissionId);
  });

  // Poll up to ~40 s; sync() will finish the job later if Instagram is slow.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await syncOne(id);
    if (updated.status === "posted" || updated.status === "failed") return updated;
  }
  return (await getPost(id))!;
}

/** Pull an approved post back off Blotato's queue. Local status returns to needs_review. */
export async function cancelRemote(id: string, setStatus = true): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  if (post.status !== "approved") throw new UserError("Only scheduled posts can be cancelled.");

  let scheduleId = post.blotato?.scheduleId;
  if (!scheduleId && post.blotato?.mediaUrl && post.scheduledAt) {
    scheduleId = await findScheduleId(post.blotato.mediaUrl, post.scheduledAt);
  }
  if (scheduleId) {
    try {
      await blotato.deleteSchedule(scheduleId);
    } catch (err) {
      if (!(err instanceof BlotatoError && err.status === 404)) throw err;
    }
  }
  return mutatePost(id, (d) => {
    if (setStatus) d.status = "needs_review";
    d.blotato = {
      ...d.blotato!,
      postSubmissionId: undefined,
      scheduleId: undefined,
      remoteStatus: undefined,
    };
    addHistory(d, "cancelled", scheduleId ? `Removed Blotato schedule ${scheduleId}` : "No remote schedule found");
  });
}

export async function reject(id: string): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  if (post.status === "posted") throw new UserError("Already posted; nothing to reject.");
  if (post.status === "approved") await cancelRemote(id, false);
  return mutatePost(id, (d) => {
    d.status = "rejected";
    addHistory(d, "rejected");
  });
}

export async function unreject(id: string): Promise<Post> {
  return mutatePost(id, (d) => {
    if (d.status !== "rejected" && d.status !== "failed") {
      throw new UserError(`Post is ${d.status}, not rejected.`);
    }
    d.status = d.media ? "needs_review" : "draft";
    addHistory(d, "reopened");
  });
}

/** Edit caption / first comment / schedule. Mirrors the change to Blotato if already approved. */
export async function applyPatch(id: string, patch: PostPatch): Promise<Post> {
  const settings = await loadSettings();
  const before = await getPost(id);
  if (!before) throw new NotFoundError(`Post ${id} not found`);
  if (before.status === "posted" || before.status === "publishing") {
    throw new UserError(`A ${before.status} post cannot be edited.`);
  }

  let scheduledAt = before.scheduledAt;
  let scheduleSource = before.scheduleSource;
  if (patch.scheduledAt === "random") {
    scheduledAt = pickRandomSlot(await listPosts(), settings, new Date(), id);
    scheduleSource = "random";
  } else if (typeof patch.scheduledAt === "string") {
    const t = new Date(patch.scheduledAt);
    if (Number.isNaN(t.getTime())) throw new UserError("Invalid schedule time.");
    scheduledAt = t.toISOString();
    scheduleSource = "manual";
  }

  const updated = await mutatePost(id, (d) => {
    if (patch.title !== undefined) d.title = patch.title.trim();
    if (patch.caption !== undefined) d.caption = patch.caption;
    if (patch.firstComment !== undefined) d.firstComment = patch.firstComment.trim() || undefined;
    if (patch.notes !== undefined) d.notes = patch.notes.trim() || undefined;
    if (scheduledAt !== before.scheduledAt) {
      d.scheduledAt = scheduledAt;
      d.scheduleSource = scheduleSource;
      addHistory(d, "rescheduled", scheduledAt ?? "unscheduled");
    }
  });

  // Mirror to Blotato when the post is already on its queue.
  if (updated.status === "approved" && updated.blotato?.scheduleId) {
    const contentChanged =
      updated.caption !== before.caption || updated.firstComment !== before.firstComment;
    const timeChanged = updated.scheduledAt !== before.scheduledAt;
    if (contentChanged || timeChanged) {
      if (timeChanged && (!updated.scheduledAt || !isFuture(updated.scheduledAt))) {
        throw new UserError("A scheduled post must move to a future time.");
      }
      await blotato.patchSchedule(updated.blotato.scheduleId, {
        ...(timeChanged ? { scheduledTime: updated.scheduledAt! } : {}),
        ...(contentChanged ? { draft: buildPayload(updated, settings) } : {}),
      });
      return mutatePost(id, (d) => {
        addHistory(d, "remote_updated");
      });
    }
  }
  return updated;
}

/** Refresh remote status for one post. */
export async function syncOne(id: string): Promise<Post> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError(`Post ${id} not found`);
  const subId = post.blotato?.postSubmissionId;
  if (!subId || (post.status !== "approved" && post.status !== "publishing")) return post;

  const s = await blotato.postStatus(subId);
  return mutatePost(id, (d) => {
    d.blotato = {
      ...d.blotato!,
      remoteStatus: s.status,
      publicUrl: s.publicUrl ?? d.blotato?.publicUrl,
      errorMessage: s.errorMessage,
      lastSyncAt: new Date().toISOString(),
    };
    if (s.status === "published") {
      d.status = "posted";
      addHistory(d, "posted", s.publicUrl);
    } else if (s.status === "failed") {
      d.status = "failed";
      addHistory(d, "failed", s.errorMessage);
    } else if (s.status === "scheduled" && s.scheduledTime) {
      d.scheduledAt = new Date(s.scheduledTime).toISOString();
    }
  });
}

/** Refresh every post that is waiting on Blotato. Returns the number of posts checked. */
export async function syncAll(): Promise<{ checked: number; changed: string[] }> {
  const posts = await listPosts();
  const pending = posts.filter(
    (p) => p.blotato?.postSubmissionId && (p.status === "approved" || p.status === "publishing"),
  );
  const changed: string[] = [];
  for (const p of pending) {
    const before = p.status;
    const after = await syncOne(p.id);
    if (after.status !== before) changed.push(p.id);
  }
  return { checked: pending.length, changed };
}

/** Find Blotato's schedule id for a post we just created (create returns only a submission id). */
async function findScheduleId(mediaUrl: string, scheduledAt: string): Promise<string | undefined> {
  try {
    const schedules = await blotato.listSchedules();
    const target = new Date(scheduledAt).getTime();
    const match =
      schedules.find((s) => s.draft?.content?.mediaUrls?.[0] === mediaUrl) ??
      schedules.find((s) => Math.abs(new Date(s.scheduledAt).getTime() - target) < 60_000);
    return match?.id;
  } catch {
    return undefined;
  }
}
