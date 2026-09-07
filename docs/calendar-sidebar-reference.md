# Sidebar + Calendar UI reference (self-contained)

Give this file to any AI or developer. It contains everything needed to rebuild the
left sidebar, the animated view switching, and the month calendar exactly as they
work in C8 Growth. No other files are required. Copy the code blocks as-is.

The look is Notion-like: flat white page, hairline borders, 13–15px type, one accent
color used only for the "today" marker and status highlights. No gradients, no glass,
no shadows beyond a 1px ring. Light theme by default, dark theme via a `.dark` class.

---

## 1. Stack and dependencies

```
Next.js 15/16 (App Router) or any React 19 app with client components
Tailwind CSS v4  (the CSS below uses @theme inline and @custom-variant)
motion            ^13   (import from "motion/react")  – all animations
date-fns          ^4    – calendar math
lucide-react      ^1    – icons
clsx + tailwind-merge   – the cn() helper
```

Install: `npm i motion date-fns lucide-react clsx tailwind-merge`

Tailwind v4 arbitrary tokens used in the code: `bg-foreground/6`, `ring-foreground/8`,
`bg-brand`, `bg-sidebar`, `text-sidebar-foreground`, `text-muted-foreground`, `bg-muted`,
`border-b`, `shadow-xs`. All of them come from the CSS in section 2.

---

## 2. Design tokens (globals.css)

```css
@import "tailwindcss";

/* Dark mode is a class on <html>, not the OS setting. */
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-brand: var(--brand);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);

  --radius-sm: 0.3rem;
  --radius-md: 0.4rem;
  --radius-lg: 0.5rem;
}

:root {
  color-scheme: light;
  --background: oklch(1 0 0);            /* white */
  --foreground: oklch(0.145 0 0);        /* near-black text */
  --muted: oklch(0.97 0 0);              /* hover fills, empty cells */
  --muted-foreground: oklch(0.556 0 0);  /* secondary text */
  --border: oklch(0.922 0 0);            /* hairlines */
  --ring: oklch(0.708 0 0);
  --brand: #2563eb;                      /* the ONLY accent color */
  --sidebar: #f7f7f5;                    /* warm off-white sidebar */
  --sidebar-foreground: oklch(0.35 0 0);
}

.dark {
  color-scheme: dark;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --border: oklch(1 0 0 / 10%);
  --ring: oklch(0.556 0 0);
  --sidebar: oklch(0.19 0 0);
  --sidebar-foreground: oklch(0.75 0 0);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
    font-feature-settings: "cv11", "ss01", "tnum";
    min-height: 100dvh;
  }
}

.tabular { font-variant-numeric: tabular-nums; }
```

Apply the saved theme before first paint (put this inline `<script>` at the top of `<body>`
so there is no flash):

```html
<script>
  (function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();
</script>
```

---

## 3. Helpers and types

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

```ts
// lib/types.ts
export type View =
  | { kind: "overview" }
  | { kind: "calendar" }
  | { kind: "table"; id: string };

export type ItemStatus = "planned" | "scripted" | "editing" | "delivered" | "posted";

export type CalendarItem = {
  id: string;
  title: string;
  date: string | null;        // "YYYY-MM-DD" or null when unscheduled
  status: ItemStatus;
  thumbUrl?: string | null;   // optional 16px thumbnail shown in the chip
};

/** Status colors, Notion-style. `dot` is the chip's left edge; `pill` is for badges. */
export const STATUSES: { value: ItemStatus; label: string; dot: string; pill: string }[] = [
  { value: "planned",   label: "Planned",   dot: "bg-neutral-400",  pill: "bg-neutral-200/70 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200" },
  { value: "scripted",  label: "Scripted",  dot: "bg-sky-500",      pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
  { value: "editing",   label: "Editing",   dot: "bg-amber-500",    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
  { value: "delivered", label: "Delivered", dot: "bg-violet-500",   pill: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" },
  { value: "posted",    label: "Posted",    dot: "bg-emerald-500",  pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
];
export const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
```

---

## 4. App shell: sidebar + animated view switching

The shell owns the current view. Switching views cross-fades the main area with a small
vertical lift (6px in, 4px out, 180ms). The view is mirrored into the URL hash so reload
and back/forward work.

```tsx
// components/app-shell.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { View } from "@/lib/types";
import { Sidebar } from "./sidebar";

function viewKey(v: View) {
  return v.kind === "table" ? `table-${v.id}` : v.kind;
}

function viewFromHash(hash: string, tableIds: string[]): View {
  const h = hash.replace(/^#/, "");
  if (h === "calendar") return { kind: "calendar" };
  if (h.startsWith("table-") && tableIds.includes(h.slice(6))) return { kind: "table", id: h.slice(6) };
  return { kind: "overview" };
}

export function AppShell({
  workspace,
  tables,
  render,
}: {
  workspace: { name: string; subtitle?: string; accent: string };
  tables: { id: string; name: string }[];
  /** Render the main area for the current view. */
  render: (view: View) => React.ReactNode;
}) {
  const [view, setViewState] = useState<View>({ kind: "overview" });
  const tableIds = tables.map((t) => t.id);

  // Restore from the hash on load and follow back/forward.
  useEffect(() => {
    const apply = () => setViewState(viewFromHash(window.location.hash, tableIds));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds.join(",")]);

  const setView = useCallback((v: View) => {
    setViewState(v);
    const hash = v.kind === "overview" ? "" : `#${viewKey(v)}`;
    history.replaceState(null, "", hash || window.location.pathname);
  }, []);

  return (
    <div style={{ ["--brand" as string]: workspace.accent }} className="flex h-dvh flex-col md:flex-row">
      <Sidebar workspace={workspace} tables={tables} view={view} setView={setView} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewKey(view)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="min-h-full"
          >
            {render(view)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
```

---

## 5. Sidebar

Desktop: fixed 240px column, warm off-white, hairline right border. Mobile (below `md`):
it collapses into a horizontal strip at the top with the same items scrolling sideways.
Active item = 6% foreground tint + medium weight. Hover = 5% tint. No animation on the
sidebar itself; the transition happens in the main area.

```tsx
// components/sidebar.tsx
"use client";

import { CalendarDays, FileText, Moon, Plus, Sun, Table2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { View } from "@/lib/types";

export function Sidebar({
  workspace,
  tables,
  view,
  setView,
  onNewTable,
}: {
  workspace: { name: string; subtitle?: string };
  tables: { id: string; name: string }[];
  view: View;
  setView: (v: View) => void;
  onNewTable?: () => void;
}) {
  const is = (v: View) =>
    v.kind === view.kind && (v.kind !== "table" || (view.kind === "table" && view.id === v.id));

  return (
    <aside className="flex shrink-0 flex-col border-b bg-sidebar text-sidebar-foreground md:h-full md:w-60 md:border-b-0 md:border-r">
      {/* Workspace header: 20px accent square with the initial, name, subtitle */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className="grid size-5 shrink-0 place-items-center rounded-[5px] text-[10px] font-semibold text-white"
          style={{ background: "var(--brand)" }}
        >
          {workspace.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-foreground">{workspace.name}</div>
          {workspace.subtitle && <div className="truncate text-[11px]">{workspace.subtitle}</div>}
        </div>
      </div>

      {/* Nav: vertical on desktop, horizontal scroll strip on mobile */}
      <nav className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
        <NavItem active={is({ kind: "overview" })} onClick={() => setView({ kind: "overview" })} icon={<FileText />}>
          Overview
        </NavItem>
        <NavItem active={is({ kind: "calendar" })} onClick={() => setView({ kind: "calendar" })} icon={<CalendarDays />}>
          Calendar
        </NavItem>

        <div className="hidden md:flex items-center justify-between px-2 pt-4 pb-1">
          <span className="text-[11px] font-medium text-muted-foreground">Tables</span>
          {onNewTable && (
            <button
              type="button"
              onClick={onNewTable}
              className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
              aria-label="New table"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
        {tables.map((t) => (
          <NavItem key={t.id} active={is({ kind: "table", id: t.id })} onClick={() => setView({ kind: "table", id: t.id })} icon={<Table2 />}>
            {t.name}
          </NavItem>
        ))}
      </nav>

      <div className="hidden flex-1 md:block" />

      {/* Footer: put auth / edit-mode controls here; theme toggle sits at the right */}
      <div className="flex items-center gap-0.5 border-t px-2 py-1.5 md:py-2">
        <span className="flex-1" />
        <ThemeToggle />
      </div>
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-[13px] transition-colors [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground",
        active
          ? "bg-foreground/6 font-medium text-foreground [&>svg]:text-foreground"
          : "hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/* Theme toggle: reads the <html> class through useSyncExternalStore, so no hydration mismatch. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/6 hover:text-foreground [&>svg]:size-3.5"
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
```

---

## 6. Calendar view

Behavior:
- Month grid, weeks start on Monday, 6 rows max, fills the main area height (`auto-rows-fr`).
- Header: month name (tabular numerals), count of scheduled items, an optional New button,
  and a grouped `< Today >` control inside one bordered pill.
- Changing month slides the grid 24px in the direction of travel and fades (200ms).
  `AnimatePresence mode="popLayout"` lets the outgoing grid leave while the new one enters.
- Today's date is a 20px filled circle in the brand color with white text. Days outside the
  month are 30% muted fill and 50% gray numbers.
- Items render as chips: white background, 1px ring at 8% foreground, a 2px left edge in the
  status color, optional 16px thumbnail, truncated title. Hover fills with `muted`.
- In edit mode the whole empty cell is clickable to create an item on that day, and a small
  "+" fades in at the top-left of the cell on hover (`opacity-0 group-hover:opacity-100`).

```tsx
// components/calendar-view.tsx
"use client";

import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { statusMeta, type CalendarItem } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  items,
  editing = false,
  onOpen,
  onCreate,
}: {
  items: CalendarItem[];
  /** Show add affordances and make empty cells clickable. */
  editing?: boolean;
  onOpen: (id: string) => void;
  onCreate?: (date: string) => void;   // "YYYY-MM-DD"
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState(0); // -1 back, +1 forward, 0 jump
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (!it.date) continue;
      if (!m.has(it.date)) m.set(it.date, []);
      m.get(it.date)!.push(it);
    }
    return m;
  }, [items]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const monthKey = format(month, "yyyy-MM");
  const inMonth = items.filter((d) => d.date?.startsWith(monthKey)).length;
  const go = (n: number) => {
    setDir(n);
    setMonth((m) => (n === 0 ? startOfMonth(new Date()) : addMonths(m, n)));
  };

  const btn = "inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex h-full flex-col px-3 pt-5 pb-4 md:px-8 md:pt-8 md:pb-6">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-4">
        <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight tabular md:text-xl">
          {format(month, "MMMM yyyy")}
        </h1>
        <span className="hidden text-sm text-muted-foreground tabular sm:inline">{inMonth} scheduled</span>
        <span className="flex-1" />
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
                    {dayItems.map((d) => {
                      const meta = statusMeta(d.status);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onOpen(d.id)}
                          title={d.title || "Untitled"}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded-sm border-l-2 bg-background px-1.5 py-1 text-left text-xs shadow-xs ring-1 ring-foreground/8 hover:bg-muted",
                            meta.dot.replace("bg-", "border-l-"),
                          )}
                        >
                          {d.thumbUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.thumbUrl} alt="" className="size-4 shrink-0 rounded-[3px] object-cover" />
                          )}
                          <span className="truncate">{d.title || "Untitled"}</span>
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
```

---

## 7. Wiring it together (example page)

```tsx
// app/page.tsx (or any client page)
"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar-view";
import type { CalendarItem } from "@/lib/types";

export default function Page() {
  const [items, setItems] = useState<CalendarItem[]>([
    { id: "1", title: "Hook #1 · Founder story", date: "2026-09-04", status: "scripted" },
    { id: "2", title: "Launch thread", date: "2026-09-08", status: "planned" },
  ]);

  return (
    <AppShell
      workspace={{ name: "3-Week Growth Sprint", subtitle: "Motionvid", accent: "#2563eb" }}
      tables={[{ id: "leads", name: "Leads" }]}
      render={(view) => {
        if (view.kind === "calendar")
          return (
            <CalendarView
              items={items}
              editing
              onOpen={(id) => alert(`open ${id}`)}
              onCreate={(date) =>
                setItems((xs) => [...xs, { id: crypto.randomUUID(), title: "", date, status: "planned" }])
              }
            />
          );
        if (view.kind === "table") return <div className="p-12">Table {view.id}</div>;
        return <div className="mx-auto max-w-[760px] px-12 pt-16">Overview</div>;
      }}
    />
  );
}
```

---

## 8. Motion spec (copy these numbers exactly)

| Element | Enter | Exit | Duration | Easing |
|---|---|---|---|---|
| Main view switch (sidebar click) | opacity 0→1, y 6→0 | opacity 1→0, y 0→−4 | 180 ms | cubic-bezier(0.2, 0, 0, 1) |
| Calendar month change | opacity 0→1, x ±24→0 (direction of travel) | opacity 1→0, x 0→∓24 | 200 ms | cubic-bezier(0.2, 0, 0, 1) |
| Cell "+" button | opacity 0→1 on cell hover | | CSS transition-opacity (150 ms default) | |
| Nav item hover/active | background-color only | | CSS transition-colors | |
| Chip hover | background → muted | | instant | |

Both view transitions use `AnimatePresence` with `initial={false}` so nothing animates on
first paint. The view switch uses `mode="wait"` (old leaves, then new enters). The month
change uses `mode="popLayout"` (both move at once, which reads as a slide).

## 9. Layout numbers

- Sidebar width 240px (`w-60`), header padding 12px, nav item height 28px, text 13px, icon 16px.
- Sidebar section label: 11px medium, muted, 16px top padding.
- Calendar: header 18–20px semibold, weekday labels 11px right-aligned, day numbers 12px,
  cell min-height 110px desktop / 72px mobile, cell padding 6px, chip text 12px, chip radius 2px.
- Hairlines everywhere are 1px `border` (oklch 0.922 light, 10% white dark). No box shadows.
- Today marker: 20px circle, `--brand` fill, white 12px number.

## 10. Rules that make it look right

1. One accent color, used only for today, active status dots, and the workspace initial.
2. Gray text hierarchy does the work: foreground for content, muted-foreground for labels.
3. Never add gradients, glass, blur, drop shadows, or rounded corners over 8px.
4. Animations are short (≤200 ms) and small (≤24 px). Nothing bounces or springs.
5. Empty states are one line of muted text, not illustrations.

---

## 11. Interaction map (what every click does)

**Sidebar**
- Click a nav item → main area cross-fades to that view (spec in §8), URL hash updates
  (`#calendar`, `#table-<id>`, nothing for overview). Reload keeps the view. Back/forward works.
- Hover a nav item → 5% tint. Active item → 6% tint, medium weight, icon turns foreground color.
- "+" next to the Tables label (edit mode only) → prompts for a name, creates the table, switches to it.
- Footer: Editing/Preview toggle (admin only), copy link, sign out, theme toggle. Anonymous
  visitors see a bordered "Sign in to edit" button instead.

**Calendar**
- `<` / `>` → previous/next month, grid slides 24px in the direction of travel. `Today` → jumps
  to the current month with no slide (`dir = 0`).
- Hover a day cell (edit mode) → cell tints `muted/50`, a small "+" fades in at the top-left.
- Click empty space in a day cell, or the "+" (edit mode) → creates a blank item dated that day
  and opens its page immediately. Guard: only fires when `e.target === e.currentTarget`, so
  clicks on chips never create.
- Click a chip → opens the item page for that item (both admin and client).
- "New" button in the header (edit mode) → creates an item dated today and opens it.
- Chips are ordered by creation. Left edge color = status. A 16px thumbnail shows when the
  item has an image attached.

**Item page (opens as a centered dialog)**
- Overlay `black/30`, panel `max-w-3xl`, rounded 12px, 1px ring at 10% foreground, fades and
  zooms from 95% in 100 ms. Escape or clicking the overlay closes. The X in the toolbar closes.
- Title: in edit mode it is a borderless 30px bold input. Blur or Enter saves. Autofocuses only
  when the title is empty (right after creation).
- Every property row is icon + label on the left (150px column, muted) and a value on the right.
  Empty values render as the word "Empty" at 60% muted.
- Pill selects (Status, Format, Type): the value is a colored pill. In edit mode the whole row
  is a button that tints on hover and opens a menu of pills with a check on the current one and
  a "Clear" entry. Picking one saves immediately.
- URL fields (Source URL, Raw Footage, Post Link): show the hostname with an external-link icon
  as a real link. In edit mode, clicking the row swaps in an input; Enter or blur saves, Escape
  cancels. Clicking the link itself opens it and does not enter edit mode (stopPropagation).
- Post Date: shows "Fri, 4 Sep 2026". In edit mode a transparent date input sits over the row,
  so clicking anywhere on it opens the native date picker. Changing saves immediately.
- Edited Video: attached files as 24px chips (thumbnail, name, size, × to remove). "Upload" /
  "Add" opens the file picker; uploads show a dashed chip with a spinner and percentage.
- Below the properties: a divider, then each attached file rendered large (image or video with
  controls), fit to its own aspect ratio, capped at 70vh, with a caption bar holding the
  filename and Download.
- Toolbar (sticky at the top of the dialog): "Saving…" text while a save is in flight, a "…" menu
  with Delete (confirm dialog), and the close X.
- Saving model: every change calls save(patch) which stores the patch in optimistic state and
  starts a transition that writes to the server and refreshes. While pending, the UI shows
  the item merged with the optimistic patch; once server data returns, it wins. No save buttons.

---

## 12. Modal (self-contained, no UI library)

Same look and motion as the shadcn/base-ui dialog used in the app, implemented with `motion`.

```tsx
// components/modal.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  children,
  className,
  overlayClassName = "bg-black/30",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn("fixed inset-0 z-50", overlayClassName)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background text-sm ring-1 ring-foreground/10 outline-none",
              className,
            )}
            initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
            transition={{ duration: 0.1 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

---

## 13. Property editors (Notion-style rows)

```tsx
// components/properties.tsx
"use client";

import { Check, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** One row: icon + label (150px, muted) on the left, value on the right. */
export function PropRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[150px_1fr] items-center gap-2" data-prop={label}>
      <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ children = "Empty" }: { children?: ReactNode }) {
  return <span className="text-sm text-muted-foreground/60">{children}</span>;
}

const rowButton = "flex min-h-8 w-full items-center rounded-md px-2 -mx-2 text-left text-sm hover:bg-muted";

/** Minimal popover menu: click outside or Escape closes. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Select rendered as a colored pill; opens a menu of pills in edit mode. */
export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  editable,
  placeholder = "Empty",
}: {
  value: T | null;
  options: { value: T; label: string; pill?: string; icon?: ReactNode }[];
  onChange: (v: T | null) => void;
  editable: boolean;
  placeholder?: string;
}) {
  const { open, setOpen, ref } = useMenu();
  const current = options.find((o) => o.value === value) ?? null;
  const Pill = ({ o }: { o: NonNullable<typeof current> }) => (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded px-1.5 text-xs font-medium", o.pill ?? "bg-muted text-foreground")}>
      {o.icon}
      {o.label}
    </span>
  );
  const shown = current ? <Pill o={current} /> : <Empty>{placeholder}</Empty>;
  if (!editable) return <div className="flex min-h-8 items-center">{shown}</div>;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={rowButton} aria-expanded={open}>
        {shown}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-44 rounded-lg bg-background p-1 shadow-md ring-1 ring-foreground/10">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
            >
              <Pill o={o} />
              {o.value === value && <Check className="ml-auto size-3.5" />}
            </button>
          ))}
          {value !== null && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Text or URL value. Read-only shows a link; edit mode turns into an input on click. */
export function InlineText({
  value,
  onSave,
  editable,
  url,
  placeholder = "Empty",
}: {
  value: string;
  onSave: (v: string) => void;
  editable: boolean;
  url?: boolean;
  placeholder?: string;
}) {
  const [editingNow, setEditingNow] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    setEditingNow(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  if (editable && editingNow) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditingNow(false);
          }
        }}
        placeholder={url ? "https://" : placeholder}
        className="h-8 w-full rounded-md bg-muted px-2 -mx-2 text-sm outline-none ring-1 ring-ring/40"
      />
    );
  }
  const display = value ? (
    url ? (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex max-w-full items-center gap-1 truncate underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
      >
        <span className="truncate">{hostOf(value)}</span>
        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
      </a>
    ) : (
      <span className="truncate">{value}</span>
    )
  ) : (
    <Empty>{placeholder}</Empty>
  );

  if (!editable) return <div className="flex min-h-8 items-center text-sm">{display}</div>;
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditingNow(true);
      }}
      className={cn(rowButton, "cursor-text")}
    >
      {display}
    </button>
  );
}

/** Date value with the native picker laid invisibly over the row. */
export function DateValue({
  value,
  onChange,
  editable,
  formatLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  editable: boolean;
  formatLabel: (iso: string) => string;
}) {
  const label = value ? formatLabel(value) : null;
  if (!editable) return <div className="flex min-h-8 items-center text-sm">{label ?? <Empty />}</div>;
  return (
    <label className="relative flex min-h-8 cursor-pointer items-center rounded-md px-2 -mx-2 text-sm hover:bg-muted">
      {label ?? <Empty />}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Date"
      />
    </label>
  );
}
```

---

## 14. Item page (what opens when you click a calendar slot)

```tsx
// components/item-page.tsx
"use client";

import { format, parseISO } from "date-fns";
import {
  CalendarDays, Clapperboard, Ellipsis, Film, Link as LinkIcon, ListChecks, Plus, Proportions, Tag, Trash2, X,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Modal } from "./modal";
import { DateValue, Empty, InlineText, PillSelect, PropRow } from "./properties";
import { STATUSES, type ItemStatus } from "@/lib/types";

export type Attachment = {
  id: string; url: string; name: string; kind: "image" | "video" | "file";
  width?: number | null; height?: number | null;
};
export type FullItem = {
  id: string;
  title: string;
  status: ItemStatus;
  format: "9:16" | "16:9" | "1:1" | "4:5" | null;
  typeId: string | null;
  sourceUrl: string;
  rawUrl: string;
  postUrl: string;
  date: string | null;
  assets: Attachment[];
};
export type ItemPatch = Partial<Omit<FullItem, "id" | "assets">>;

const FORMATS = ["9:16", "16:9", "1:1", "4:5"] as const;

type Props = {
  item: FullItem | null;
  types: { id: string; name: string }[];
  editing: boolean;
  onClose: () => void;
  onSave: (id: string, patch: ItemPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpload?: (id: string, files: File[], onProgress: (name: string, pct: number) => void) => Promise<void>;
  onRemoveFile?: (id: string, assetId: string) => Promise<void>;
};

export function ItemPage(props: Props) {
  return (
    <Modal open={props.item !== null} onClose={props.onClose}>
      {props.item && <Body key={props.item.id} {...props} item={props.item} />}
    </Modal>
  );
}

function Body({ item, types, editing, onClose, onSave, onDelete, onUpload, onRemoveFile }: Props & { item: FullItem }) {
  const [isPending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<ItemPatch>({});
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [menu, setMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Optimistic while a save is in flight; server data wins afterwards.
  const view: FullItem = isPending ? { ...item, ...optimistic } : item;
  const save = (patch: ItemPatch) => {
    setOptimistic((o) => ({ ...o, ...patch }));
    start(async () => {
      await onSave(item.id, patch);
    });
  };

  async function pick(list: FileList | null) {
    if (!list?.length || !onUpload) return;
    const files = Array.from(list);
    setUploads(files.map((f) => ({ name: f.name, pct: 0 })));
    try {
      await onUpload(item.id, files, (name, pct) =>
        setUploads((u) => u.map((x) => (x.name === name ? { ...x, pct } : x))),
      );
    } finally {
      setUploads([]);
    }
  }

  const iconBtn = "grid size-7 place-items-center rounded-md hover:bg-muted";

  return (
    <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex h-10 items-center justify-end gap-0.5 bg-background/90 px-2 backdrop-blur">
        {isPending && <span className="mr-2 text-[11px] text-muted-foreground">Saving…</span>}
        {editing && (
          <div className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} className={iconBtn} aria-label="More">
              <Ellipsis className="size-4" />
            </button>
            {menu && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-32 rounded-lg bg-background p-1 shadow-md ring-1 ring-foreground/10">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete "${item.title || "this item"}"?`)) onDelete(item.id).then(onClose);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-10 pb-12 pt-2 md:px-14">
        {/* Title */}
        {editing ? (
          <TitleInput value={item.title} onSave={(t) => save({ title: t })} />
        ) : (
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            {item.title || <span className="text-muted-foreground/60">Untitled</span>}
          </h1>
        )}

        {/* Properties */}
        <div className="mt-5 grid gap-y-0.5">
          <PropRow icon={<ListChecks />} label="Status">
            <PillSelect<ItemStatus>
              value={view.status}
              editable={editing}
              onChange={(v) => save({ status: v ?? "planned" })}
              options={STATUSES.map((s) => ({ value: s.value, label: s.label, pill: s.pill }))}
            />
          </PropRow>
          <PropRow icon={<Proportions />} label="Format">
            <PillSelect
              value={view.format}
              editable={editing}
              onChange={(v) => save({ format: v })}
              options={FORMATS.map((f) => ({ value: f, label: f }))}
            />
          </PropRow>
          <PropRow icon={<Tag />} label="Type">
            <PillSelect
              value={view.typeId}
              editable={editing}
              onChange={(v) => save({ typeId: v })}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder={types.length ? "Empty" : "No content types yet"}
            />
          </PropRow>
          <PropRow icon={<LinkIcon />} label="Source URL">
            <InlineText url value={view.sourceUrl} editable={editing} onSave={(v) => save({ sourceUrl: v })} />
          </PropRow>
          <PropRow icon={<Clapperboard />} label="Raw Footage">
            <InlineText url value={view.rawUrl} editable={editing} onSave={(v) => save({ rawUrl: v })} />
          </PropRow>
          <PropRow icon={<Film />} label="Edited Video">
            <div className="flex min-h-8 flex-wrap items-center gap-1.5 py-1">
              {item.assets.map((a) => (
                <span key={a.id} className="inline-flex h-6 max-w-full items-center gap-1.5 rounded border bg-background pl-1 pr-1.5 text-xs">
                  <span className="relative size-4 shrink-0 overflow-hidden rounded-[3px] bg-muted">
                    {a.kind === "image" && <img src={a.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  </span>
                  <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:underline underline-offset-2">
                    {a.name || a.kind}
                  </a>
                  {editing && onRemoveFile && (
                    <button
                      type="button"
                      onClick={() => confirm(`Remove ${a.name}?`) && onRemoveFile(item.id, a.id)}
                      className="ml-0.5 text-muted-foreground hover:text-red-600"
                      aria-label="Remove file"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}
              {uploads.map((u) => (
                <span key={u.name} className="inline-flex h-6 items-center gap-1.5 rounded border border-dashed px-1.5 text-xs text-muted-foreground">
                  {u.name} · {u.pct}%
                </span>
              ))}
              {editing && onUpload && uploads.length === 0 && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      pick(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3" /> {item.assets.length ? "Add" : "Upload"}
                  </button>
                </>
              )}
              {!editing && item.assets.length === 0 && <Empty />}
            </div>
          </PropRow>
          <PropRow icon={<CalendarDays />} label="Post Date">
            <DateValue
              value={view.date}
              editable={editing}
              onChange={(v) => save({ date: v })}
              formatLabel={(iso) => format(parseISO(iso), "EEE, d MMM yyyy")}
            />
          </PropRow>
          <PropRow icon={<LinkIcon />} label="Post Link">
            <InlineText url value={view.postUrl} editable={editing} onSave={(v) => save({ postUrl: v })} />
          </PropRow>
        </div>

        {/* Media, large */}
        {item.assets.length > 0 && (
          <div className="mt-6 space-y-4 border-t pt-6">
            {item.assets.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-lg border bg-muted">
                <div
                  className="relative mx-auto w-full"
                  style={{
                    aspectRatio: a.width && a.height ? `${a.width} / ${a.height}` : "16 / 9",
                    maxHeight: "70vh",
                    maxWidth: a.width && a.height && a.height > a.width ? `calc(70vh * ${a.width} / ${a.height})` : undefined,
                  }}
                >
                  {a.kind === "video" ? (
                    <video src={a.url} controls playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />
                  ) : (
                    <img src={a.url} alt={a.name} className="absolute inset-0 h-full w-full object-contain" />
                  )}
                </div>
                <figcaption className="flex items-center justify-between border-t bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{a.name}</span>
                  <a href={a.url} download target="_blank" rel="noreferrer" className="shrink-0 hover:text-foreground">
                    Download
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {item.date && (
          <p className="mt-8 text-xs text-muted-foreground">Scheduled for {format(parseISO(item.date), "EEEE, d MMMM yyyy")}</p>
        )}
      </div>
    </div>
  );
}

function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      autoFocus={!value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="Untitled"
      className="-mx-1 w-full rounded px-1 text-[30px] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/40 focus:bg-muted/60"
    />
  );
}
```

---

## 15. Wiring the calendar to the item page

```tsx
// inside the page from §7: keep items in state, open the page on chip click, create on empty-cell click
const [openId, setOpenId] = useState<string | null>(null);
const open = items.find((i) => i.id === openId) ?? null;

<CalendarView
  items={items}
  editing
  onOpen={setOpenId}
  onCreate={(date) => {
    const id = crypto.randomUUID();
    setItems((xs) => [
      ...xs,
      { id, title: "", date, status: "planned", sourceUrl: "", rawUrl: "", postUrl: "", format: null, typeId: null, assets: [] },
    ]);
    setOpenId(id); // create, then open immediately, like Notion's "New"
  }}
/>
<ItemPage
  item={open}
  types={[{ id: "reels", name: "Short Form" }, { id: "x", name: "X Posts" }]}
  editing
  onClose={() => setOpenId(null)}
  onSave={async (id, patch) => setItems((xs) => xs.map((i) => (i.id === id ? { ...i, ...patch } : i)))}
  onDelete={async (id) => setItems((xs) => xs.filter((i) => i.id !== id))}
/>
```

For this to compile, `CalendarItem` in §3 should carry the same fields as `FullItem` (or map
between them). In the real app onSave/onDelete/onUpload call server actions and then refresh
the route; the components above do not care where the data comes from.
