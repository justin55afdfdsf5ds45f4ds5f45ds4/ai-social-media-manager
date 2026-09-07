import type { PostStatus } from "./types";

/** Status colors, Notion-style. `dot` is the chip's left edge; `pill` is for badges. */
export const STATUSES: { value: PostStatus; label: string; dot: string; pill: string }[] = [
  {
    value: "draft",
    label: "Planned",
    dot: "bg-neutral-400",
    pill: "bg-neutral-200/70 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200",
  },
  {
    value: "needs_review",
    label: "Needs review",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  },
  {
    value: "approved",
    label: "Scheduled",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  },
  {
    value: "publishing",
    label: "Publishing",
    dot: "bg-violet-500",
    pill: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  },
  {
    value: "posted",
    label: "Posted",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  },
  {
    value: "failed",
    label: "Failed",
    dot: "bg-rose-500",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  },
  {
    value: "rejected",
    label: "Rejected",
    dot: "bg-neutral-300 dark:bg-neutral-600",
    pill: "bg-neutral-100 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-400",
  },
];

export const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
