"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Centered dialog: 30% overlay, panel fades + zooms from 95% in 100 ms. Escape / overlay click closes. */
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
              // Centering comes from motion's x/y (-50%) below. Tailwind v4's -translate-* classes use the
              // separate `translate` property and would stack on top of it, pushing the panel off-screen.
              "fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-3xl rounded-xl bg-background text-sm ring-1 ring-foreground/10 outline-none",
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
