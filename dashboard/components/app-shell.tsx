"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { View } from "@/lib/types";
import { Sidebar } from "./sidebar";

function viewFromHash(hash: string): View {
  const h = hash.replace(/^#/, "");
  if (h === "calendar") return { kind: "calendar" };
  if (h === "queue") return { kind: "queue" };
  return { kind: "overview" };
}

export function AppShell({
  workspace,
  counts,
  onSync,
  syncing,
  render,
}: {
  workspace: { name: string; subtitle?: string; accent: string };
  counts: { review: number; scheduled: number };
  onSync: () => void;
  syncing: boolean;
  render: (view: View) => React.ReactNode;
}) {
  const [view, setViewState] = useState<View>({ kind: "overview" });

  useEffect(() => {
    const apply = () => setViewState(viewFromHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const setView = useCallback((v: View) => {
    setViewState(v);
    const hash = v.kind === "overview" ? "" : `#${v.kind}`;
    history.replaceState(null, "", hash || window.location.pathname);
  }, []);

  return (
    <div
      style={{ ["--brand" as string]: workspace.accent }}
      className="flex h-dvh flex-col md:flex-row"
    >
      <Sidebar
        workspace={workspace}
        view={view}
        setView={setView}
        counts={counts}
        onSync={onSync}
        syncing={syncing}
      />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view.kind}
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
