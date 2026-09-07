"use client";

import { CalendarDays, LayoutList, Moon, RefreshCw, Sun, FileText } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { View } from "@/lib/types";

export function Sidebar({
  workspace,
  view,
  setView,
  counts,
  onSync,
  syncing,
}: {
  workspace: { name: string; subtitle?: string };
  view: View;
  setView: (v: View) => void;
  counts: { review: number; scheduled: number };
  onSync: () => void;
  syncing: boolean;
}) {
  const is = (k: View["kind"]) => view.kind === k;

  return (
    <aside className="flex shrink-0 flex-col border-b bg-sidebar text-sidebar-foreground md:h-full md:w-60 md:border-b-0 md:border-r">
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

      <nav className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
        <NavItem active={is("overview")} onClick={() => setView({ kind: "overview" })} icon={<FileText />}>
          Overview
        </NavItem>
        <NavItem
          active={is("calendar")}
          onClick={() => setView({ kind: "calendar" })}
          icon={<CalendarDays />}
          badge={counts.scheduled || undefined}
        >
          Calendar
        </NavItem>
        <NavItem
          active={is("queue")}
          onClick={() => setView({ kind: "queue" })}
          icon={<LayoutList />}
          badge={counts.review || undefined}
          badgeTone={counts.review ? "amber" : undefined}
        >
          Queue
        </NavItem>
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="flex items-center gap-0.5 border-t px-2 py-1.5 md:py-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-foreground/6 hover:text-foreground disabled:opacity-60 [&>svg]:size-3.5"
          title="Ask Blotato for the latest status of scheduled posts"
        >
          <RefreshCw className={cn(syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
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
  badge,
  badgeTone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  badgeTone?: "amber";
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
      {badge !== undefined && (
        <span
          className={cn(
            "ml-auto rounded px-1.5 text-[10px] font-medium tabular",
            badgeTone === "amber"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              : "bg-foreground/8 text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

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
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
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
