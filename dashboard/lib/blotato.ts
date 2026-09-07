import { promises as fs } from "node:fs";
import path from "node:path";
import { requireEnv } from "./paths";
import type { AccountInfo, RemoteStatus } from "./types";

/**
 * Minimal Blotato REST client for the calls this project needs.
 * Docs: https://help.blotato.com/api  (condensed in ../docs/blotato-api.md)
 */

export const BLOTATO_BASE = "https://backend.blotato.com/v2";

export class BlotatoError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "BlotatoError";
  }
}

export type InstagramTarget = {
  targetType: "instagram";
  mediaType?: "reel" | "story";
  altText?: string;
  collaborators?: string[];
  coverImageUrl?: string;
  shareToFeed?: boolean;
  audioName?: string;
  trial?: { graduationStrategy: "MANUAL" | "SS_PERFORMANCE" };
  firstComment?: string;
};

export type PostPayload = {
  accountId: string;
  content: { text: string; mediaUrls: string[]; platform: "instagram" };
  target: InstagramTarget;
};

export type CreatePostResponse = { postSubmissionId: string; scheduledTime?: string };

export type PostStatusResponse = {
  postSubmissionId: string;
  status: RemoteStatus;
  scheduledTime?: string;
  publicUrl?: string;
  errorMessage?: string;
};

export type ScheduleItem = {
  id: string;
  scheduledAt: string;
  account: { id: string; username?: string } | null;
  draft: PostPayload;
};

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function mimeFor(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BLOTATO_BASE}${route}`, {
    method,
    headers: {
      "blotato-api-key": requireEnv("BLOTATO_API_KEY"),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new BlotatoError(
      res.status,
      extractMessage(json) ?? `Blotato ${method} ${route} failed with HTTP ${res.status}`,
      json,
    );
  }
  return json as T;
}

function extractMessage(json: unknown): string | undefined {
  if (json && typeof json === "object" && "message" in json) {
    const m = (json as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map(String).join("; ");
  }
  if (typeof json === "string" && json.trim()) return json.slice(0, 300);
  return undefined;
}

export const blotato = {
  me() {
    return request<{ id: string; subscriptionStatus: string; subscriptionPlan?: string }>(
      "GET",
      "/users/me",
    );
  },

  async accounts(platform?: string): Promise<AccountInfo[]> {
    const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
    const r = await request<{ items: AccountInfo[] }>("GET", `/users/me/accounts${q}`);
    return r.items ?? [];
  },

  /**
   * Presigned upload: local file → public URL usable in `mediaUrls`.
   * Retries the whole flow once because the presigned URL is short-lived.
   */
  async uploadFile(filePath: string, filename = path.basename(filePath)): Promise<string> {
    const data = await fs.readFile(filePath);
    const contentType = mimeFor(filename);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { presignedUrl, publicUrl } = await request<{
          presignedUrl: string;
          publicUrl: string;
        }>("POST", "/media/uploads", { filename });
        const put = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: new Uint8Array(data),
        });
        if (!put.ok) {
          throw new BlotatoError(put.status, `Upload PUT failed (${put.status}) for ${filename}`);
        }
        return publicUrl;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw lastErr;
  },

  createPost(post: PostPayload, scheduledTime?: string) {
    return request<CreatePostResponse>("POST", "/posts", {
      post,
      ...(scheduledTime ? { scheduledTime } : {}),
    });
  },

  postStatus(postSubmissionId: string) {
    return request<PostStatusResponse>("GET", `/posts/${encodeURIComponent(postSubmissionId)}`);
  },

  async listSchedules(): Promise<ScheduleItem[]> {
    const all: ScheduleItem[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams({ limit: "50" });
      if (cursor) q.set("cursor", cursor);
      const r = await request<{ items: ScheduleItem[]; cursor?: string }>(
        "GET",
        `/schedules?${q}`,
      );
      all.push(...(r.items ?? []));
      if (!r.cursor) break;
      cursor = r.cursor;
    }
    return all;
  },

  patchSchedule(id: string, patch: { scheduledTime?: string; draft?: PostPayload }) {
    return request<unknown>("PATCH", `/schedules/${encodeURIComponent(id)}`, { patch });
  },

  deleteSchedule(id: string) {
    return request<unknown>("DELETE", `/schedules/${encodeURIComponent(id)}`);
  },
};
