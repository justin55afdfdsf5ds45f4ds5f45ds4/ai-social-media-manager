"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar-view";
import { OverviewView } from "@/components/overview-view";
import { PostPage } from "@/components/post-page";
import { QueueView } from "@/components/queue-view";
import { client } from "@/lib/client";
import type { MediaKind, Post, PostAction, PostPatch, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Toast = { kind: "ok" | "error"; text: string };

export default function Page() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), t.kind === "error" ? 7000 : 3000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSnap(await client.snapshot());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await client.sync();
      await refresh();
      if (r.changed.length) showToast({ kind: "ok", text: `${r.changed.length} post(s) changed status.` });
    } catch (err) {
      showToast({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSyncing(false);
    }
  }, [refresh, showToast]);

  // Load, then quietly sync with Blotato, then keep syncing every few minutes.
  useEffect(() => {
    refresh().then(() => sync());
    const t = setInterval(sync, 5 * 60_000);
    return () => clearInterval(t);
  }, [refresh, sync]);

  const upsert = useCallback(
    (p: Post) =>
      setSnap(
        (s) =>
          s && {
            ...s,
            posts: s.posts.some((x) => x.id === p.id) ? s.posts.map((x) => (x.id === p.id ? p : x)) : [...s.posts, p],
          },
      ),
    [],
  );

  const fail = (err: unknown) => showToast({ kind: "error", text: err instanceof Error ? err.message : String(err) });

  /** Silent save: no toast on success (Notion-style), toast only on error. */
  const onSave = async (id: string, patch: PostPatch) => {
    try {
      upsert(await client.patch(id, patch));
    } catch (err) {
      fail(err);
    }
  };

  const onAction = async (id: string, action: PostAction) => {
    const labels: Record<PostAction, string> = {
      approve: "Approved. Blotato will post it at the scheduled time.",
      publish: "Sent to Instagram.",
      reject: "Rejected.",
      cancel: "Removed from Blotato's queue.",
      unreject: "Reopened.",
    };
    setBusy(true);
    try {
      const p = await client.act(id, action);
      upsert(p);
      showToast({
        kind: "ok",
        text: action === "publish" && p.status === "publishing" ? "Instagram is still processing. Sync in a minute." : labels[action],
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await client.remove(id);
      setSnap((s) => s && { ...s, posts: s.posts.filter((p) => p.id !== id) });
      setSelectedId(null);
      showToast({ kind: "ok", text: "Deleted." });
    } catch (err) {
      fail(err);
    }
  };

  const onCreate = async (date: string) => {
    try {
      const p = await client.createDraft({ date });
      upsert(p);
      setSelectedId(p.id); // create, then open immediately, like Notion's "New"
    } catch (err) {
      fail(err);
    }
  };

  const onUpload = async (id: string, file: File, kind: MediaKind, onProgress: (pct: number) => void) => {
    try {
      upsert(await client.upload(id, file, kind, onProgress));
    } catch (err) {
      fail(err);
    }
  };

  const onRemoveFile = async (id: string, kind: MediaKind) => {
    try {
      upsert(await client.removeMedia(id, kind));
    } catch (err) {
      fail(err);
    }
  };

  const posts = snap?.posts ?? [];
  const tz = snap?.settings.timezone ?? "UTC";
  const selected = posts.find((p) => p.id === selectedId) ?? null;
  const counts = {
    review: posts.filter((p) => p.status === "needs_review").length,
    scheduled: posts.filter((p) => p.status === "approved").length,
  };
  const subtitle = snap?.account
    ? `@${snap.account.username || snap.account.fullname} · Instagram`
    : "Instagram via Blotato";

  return (
    <>
      <AppShell
        workspace={{ name: "Social Manager", subtitle, accent: "#2563eb" }}
        counts={counts}
        onSync={sync}
        syncing={syncing}
        render={(view) => {
          if (loadError)
            return (
              <div className="mx-auto max-w-[760px] px-12 pt-16 text-sm">
                <p className="text-rose-600 dark:text-rose-300">Could not load the queue: {loadError}</p>
                <p className="mt-2 text-muted-foreground">
                  Check that <code>data/posts.json</code> is readable and the dev server is running from <code>dashboard/</code>.
                </p>
              </div>
            );
          if (!snap) return <div className="px-12 pt-16 text-sm text-muted-foreground">Loading…</div>;
          if (view.kind === "calendar")
            return <CalendarView posts={posts} tz={tz} editing onOpen={setSelectedId} onCreate={onCreate} />;
          if (view.kind === "queue") return <QueueView posts={posts} tz={tz} onOpen={setSelectedId} />;
          return (
            <OverviewView posts={posts} tz={tz} account={snap.account} accountError={snap.error} onOpen={setSelectedId} />
          );
        }}
      />

      <PostPage
        post={selected}
        tz={tz}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onSave={onSave}
        onAction={onAction}
        onDelete={onDelete}
        onUpload={onUpload}
        onRemoveFile={onRemoveFile}
      />

      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-md border px-3 py-2 text-[13px] shadow-xs",
            toast.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-200"
              : "bg-background text-foreground",
          )}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
