"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { statusMeta } from "@/lib/status";
import { dayKey, formatTimeInTz } from "@/lib/time";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  posts,
  tz,
  editing = false,
  onOpen,
  onCreate,
}: {
  posts: Post[];
  tz: string;
  /** Show add affordances and make empty cells clickable. */
  editing?: boolean;
  onOpen: (id: string) => void;
  onCreate?: (date: string) => void; // "YYYY-MM-DD"
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState(0); // -1 back, +1 forward, 0 jump
  const todayKey = dayKey(new Date(), tz);

  const byDay = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      const k = dayKey(p.scheduledAt, tz);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    for (const list of m.values()) {
      list.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
    }
    return m;
  }, [posts, tz]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const monthKey = format(month, "yyyy-MM");
  const inMonth = posts.filter(
    (p) => p.scheduledAt && dayKey(p.scheduledAt, tz).startsWith(monthKey) && p.status !== "rejected",
  ).length;
  const go = (n: number) => {
    setDir(n);
    setMonth((m) => (n === 0 ? startOfMonth(new Date()) : addMonths(m, n)));
  };

  const btn =
    "inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex h-full flex-col px-3 pt-5 pb-4 md:px-8 md:pt-8 md:pb-6">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-4">
        <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight tabular md:text-xl">
          {format(month, "MMMM yyyy")}
        </h1>
        <span className="hidden text-sm text-muted-foreground tabular sm:inline">{inMonth} scheduled</span>
        <span className="flex-1" />
        <span className="hidden text-[11px] text-muted-foreground md:inline">{tz}</span>
        {editing && onCreate && (
          <button
            type="button"
            onClick={() => onCreate(todayKey)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-[0.8rem] font-medium text-background hover:opacity-90 [&>svg]:size-3.5"
          >
            <Plus /> New
          </button>
        )}
        <div className="ml-1 flex items-center rounded-md border">
          <button type="button" className={cn(btn, "size-7 rounded-r-none")} onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className={cn(btn, "h-7 rounded-none border-x px-2 text-xs")} onClick={() => go(0)}>
            Today
          </button>
          <button type="button" className={cn(btn, "size-7 rounded-l-none")} onClick={() => go(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 pb-1.5 text-right text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      {/* Month grid with slide transition */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={monthKey}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="grid h-full grid-cols-7 auto-rows-fr"
          >
            {days.map((day, i) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = byDay.get(key) ?? [];
              const muted = !isSameMonth(day, month);
              const isToday = key === todayKey;
              const createHere = (e: React.MouseEvent) => {
                // Only empty space creates; clicks on chips open them instead.
                if (editing && onCreate && e.target === e.currentTarget) onCreate(key);
              };
              return (
                <div
                  key={key}
                  className={cn(
                    "group relative min-h-[72px] border-b border-r p-1 md:min-h-[110px] md:p-1.5 [&:nth-child(7n)]:border-r-0",
                    i >= days.length - 7 && "border-b-0",
                    muted && "bg-muted/30",
                    editing && "cursor-pointer hover:bg-muted/50",
                  )}
                  onClick={createHere}
                  role={editing ? "button" : undefined}
                  title={editing ? "Click to add" : undefined}
                >
                  <div className="flex items-center justify-between">
                    {editing && onCreate ? (
                      <button
                        type="button"
                        onClick={() => onCreate(key)}
                        className="grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                        aria-label={`Add on ${key}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    ) : (
                      <span />
                    )}
                    <span
                      className={cn(
                        "text-xs tabular",
                        isToday
                          ? "grid size-5 place-items-center rounded-full bg-brand font-medium text-white"
                          : muted
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="mt-1 space-y-0.5" onClick={createHere}>
                    {dayItems.map((p) => {
                      const meta = statusMeta(p.status);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpen(p.id)}
                          title={`${meta.label} · ${p.title || "Untitled"}`}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded-sm border-l-2 bg-background px-1.5 py-1 text-left text-xs shadow-xs ring-1 ring-foreground/8 hover:bg-muted",
                            meta.dot.replace("bg-", "border-l-"),
                            p.status === "rejected" && "opacity-50",
                          )}
                        >
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular">
                            {formatTimeInTz(p.scheduledAt!, tz)}
                          </span>
                          <span className={cn("truncate", !p.title && "text-muted-foreground/60")}>
                            {p.title || "Untitled"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
