/**
 * Shared types. This file is imported by both server and client code,
 * so it must stay free of Node imports.
 */

export type View = { kind: "overview" } | { kind: "calendar" } | { kind: "queue" };

/**
 * Lifecycle of a post:
 *
 *   draft (planned slot, no video yet) ──reel attached──▶ needs_review
 *   needs_review ──approve──▶ approved (scheduled on Blotato) ──time passes──▶ posted | failed
 *        │                        │
 *        ├──post now──▶ publishing ──▶ posted | failed
 *        └──reject──▶ rejected
 */
export type PostStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "publishing"
  | "posted"
  | "failed"
  | "rejected";

export type ScheduleSource = "random" | "manual" | "asap";

export type RemoteStatus = "in-progress" | "scheduled" | "published" | "failed";

export type PostMedia = {
  /** File name inside content/posts/<id>/, e.g. "reel.mp4" */
  video: string;
  /** Optional cover image file name inside the same folder */
  cover?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export type BlotatoInfo = {
  accountId: string;
  mediaUrl?: string;
  coverUrl?: string;
  postSubmissionId?: string;
  scheduleId?: string;
  remoteStatus?: RemoteStatus;
  publicUrl?: string;
  errorMessage?: string;
  lastSyncAt?: string;
};

export type HistoryEntry = { at: string; event: string; detail?: string };

export type Post = {
  id: string;
  title: string;
  caption: string;
  firstComment?: string;
  /** Absent while the post is a planned slot with no reel attached yet. */
  media?: PostMedia;
  /** ISO 8601 UTC. null = not scheduled yet. */
  scheduledAt: string | null;
  scheduleSource: ScheduleSource;
  status: PostStatus;
  /** Free-form notes: the brief for the AI, or the AI's notes to the reviewer. */
  notes?: string;
  blotato?: BlotatoInfo;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
};

export type Settings = {
  timezone: string;
  postingWindows: { start: string; end: string }[];
  randomSchedule: {
    daysAhead: number;
    minGapHours: number;
    maxPerDay: number;
    roundToMinutes: number;
  };
  instagram: {
    shareToFeed: boolean;
    defaultHashtags: string[];
  };
};

export type AccountInfo = {
  id: string;
  platform: string;
  username: string;
  fullname: string;
};

/** Payload the dashboard fetches on load. */
export type Snapshot = {
  posts: Post[];
  settings: Settings;
  account: AccountInfo | null;
  error?: string;
};

export type PostAction = "approve" | "publish" | "reject" | "cancel" | "unreject";

export type PostPatch = {
  title?: string;
  caption?: string;
  firstComment?: string;
  notes?: string;
  /** ISO string, or the literal "random" to draw a fresh random slot. */
  scheduledAt?: string | "random";
};

/** Body for creating a planned slot from the calendar. */
export type CreateDraftInput = {
  kind: "draft";
  /** "YYYY-MM-DD" in the workspace timezone; a random time inside the posting windows is chosen. */
  date?: string;
  /** Or an exact ISO instant. */
  scheduledAt?: string;
  title?: string;
  notes?: string;
};

export type MediaKind = "video" | "cover";
