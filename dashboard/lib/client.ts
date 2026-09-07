"use client";

import type { CreateDraftInput, MediaKind, Post, PostAction, PostPatch, Snapshot } from "./types";

/** Thin fetch wrapper: throws Error(message) using the server's `error` field. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

/** Upload with progress (XHR, because fetch has no upload progress). */
function upload(id: string, file: File, kind: MediaKind, onProgress: (pct: number) => void): Promise<Post> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/posts/${id}/media`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error("Upload failed (network)."));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as Post);
        else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file, file.name);
    xhr.send(fd);
  });
}

export const client = {
  snapshot: () => api<Snapshot>("/api/posts"),
  sync: () => api<{ checked: number; changed: string[] }>("/api/sync", { method: "POST" }),
  createDraft: (input: Omit<CreateDraftInput, "kind">) =>
    api<Post>("/api/posts", { method: "POST", body: JSON.stringify({ kind: "draft", ...input }) }),
  patch: (id: string, patch: PostPatch) =>
    api<Post>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  act: (id: string, action: PostAction) =>
    api<Post>(`/api/posts/${id}/actions`, { method: "POST", body: JSON.stringify({ action }) }),
  remove: (id: string) => api<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" }),
  upload,
  removeMedia: (id: string, kind: MediaKind) =>
    api<Post>(`/api/posts/${id}/media?kind=${kind}`, { method: "DELETE" }),
  mediaUrl: (id: string, file: string) => `/api/media/${id}/${encodeURIComponent(file)}`,
};
