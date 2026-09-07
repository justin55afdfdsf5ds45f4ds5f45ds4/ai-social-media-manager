"use client";

import { useState } from "react";
import { STATUSES, statusMeta } from "@/lib/status";
import { formatInTz } from "@/lib/time";
import type { Post, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QueueView({
  posts,
  tz,
  onOpen,
}: {
  posts: Post[];
  tz: string;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const rows = posts.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="px-3 pt-5 pb-8 md:px-8 md:pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight md:text-xl">Queue</h1>
        <span className="text-sm text-muted-foreground tabular">{rows.length}</span>
        <span className="flex-1" />
        <div className="flex flex-wrap gap-0.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {STATUSES.map((s) => {
            const n = posts.filter((p) => p.status === s.value).length;
            if (!n) return null;
            return (
              <Chip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>
                {s.label} <span className="text-muted-foreground tabular">{n}</span>
              </Chip>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts here.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b text-left text-[11px] font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Scheduled ({tz})</th>
                <th className="px-3 py-2 text-right">Length</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const meta = statusMeta(p.status);
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <td className="px-3 py-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", meta.pill)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2">{p.title || "Untitled"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular">
                      {p.scheduledAt ? formatInTz(p.scheduledAt, tz, true) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground">
                      {p.media?.durationSec ? `${Math.round(p.media.durationSec)}s` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.scheduleSource}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular">
                      {formatInTz(p.createdAt, tz)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-2 text-[12px] transition-colors",
        active ? "bg-foreground/6 font-medium" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
