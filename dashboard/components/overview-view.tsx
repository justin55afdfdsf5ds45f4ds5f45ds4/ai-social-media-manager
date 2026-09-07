"use client";

import { ArrowUpRight } from "lucide-react";
import { statusMeta } from "@/lib/status";
import { formatInTz } from "@/lib/time";
import type { AccountInfo, Post } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OverviewView({
  posts,
  tz,
  account,
  accountError,
  onOpen,
}: {
  posts: Post[];
  tz: string;
  account: AccountInfo | null;
  accountError?: string;
  onOpen: (id: string) => void;
}) {
  const review = posts.filter((p) => p.status === "needs_review");
  const planned = posts
    .filter((p) => p.status === "draft")
    .sort((a, b) => Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? ""));
  const scheduled = posts
    .filter((p) => p.status === "approved" || p.status === "publishing")
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const posted = posts.filter((p) => p.status === "posted");
  const failed = posts.filter((p) => p.status === "failed");

  return (
    <div className="mx-auto max-w-[760px] px-5 pt-10 pb-16 md:px-12 md:pt-16">
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {account ? (
          <>
            Posting to <span className="text-foreground">@{account.username || account.fullname}</span> on
            Instagram via Blotato · {tz}
          </>
        ) : accountError ? (
          <span className="text-rose-600 dark:text-rose-300">Blotato: {accountError}</span>
        ) : (
          "No Instagram account connected in Blotato."
        )}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
        <Stat label="Needs review" value={review.length} tone={review.length ? "amber" : undefined} />
        <Stat label="Scheduled" value={scheduled.length} />
        <Stat label="Posted" value={posted.length} />
        <Stat label="Failed" value={failed.length} tone={failed.length ? "rose" : undefined} />
      </div>

      <Section title="Needs your review" empty="Nothing waiting. New reels from the AI appear here.">
        {review.map((p) => (
          <Row key={p.id} post={p} tz={tz} onOpen={onOpen} />
        ))}
      </Section>

      {planned.length > 0 && (
        <Section title="Planned slots (no reel yet)" empty="">
          {planned.map((p) => (
            <Row key={p.id} post={p} tz={tz} onOpen={onOpen} />
          ))}
        </Section>
      )}

      <Section title="Up next" empty="No approved posts on Blotato's queue.">
        {scheduled.slice(0, 8).map((p) => (
          <Row key={p.id} post={p} tz={tz} onOpen={onOpen} />
        ))}
      </Section>

      {failed.length > 0 && (
        <Section title="Failed" empty="">
          {failed.map((p) => (
            <Row key={p.id} post={p} tz={tz} onOpen={onOpen} />
          ))}
        </Section>
      )}

      <Section title="Recently posted" empty="Nothing posted yet.">
        {posted
          .slice()
          .sort((a, b) => Date.parse(b.scheduledAt ?? b.updatedAt) - Date.parse(a.scheduledAt ?? a.updatedAt))
          .slice(0, 6)
          .map((p) => (
            <Row key={p.id} post={p} tz={tz} onOpen={onOpen} />
          ))}
      </Section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "rose" }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular",
          tone === "amber" && "text-amber-600 dark:text-amber-300",
          tone === "rose" && "text-rose-600 dark:text-rose-300",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">{title}</h2>
      {hasItems ? (
        <div className="divide-y rounded-md border">{children}</div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function Row({ post, tz, onOpen }: { post: Post; tz: string; onOpen: (id: string) => void }) {
  const meta = statusMeta(post.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
      <span className="min-w-0 flex-1 truncate">{post.title || "Untitled"}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular">
        {post.scheduledAt ? formatInTz(post.scheduledAt, tz) : "Unscheduled"}
      </span>
      {post.blotato?.publicUrl ? (
        <a
          href={post.blotato.publicUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
          aria-label="Open on Instagram"
        >
          <ArrowUpRight className="size-3.5" />
        </a>
      ) : (
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", meta.pill)}>
          {meta.label}
        </span>
      )}
    </button>
  );
}
