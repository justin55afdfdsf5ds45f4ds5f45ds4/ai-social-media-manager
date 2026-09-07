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
    <div className="grid min-h-8 grid-cols-[150px_1fr] items-start gap-2" data-prop={label}>
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
export function useMenu() {
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

/**
 * Multi-line variant of InlineText for captions and notes.
 * Click to edit; blur or Ctrl/⌘+Enter saves; Escape cancels.
 */
export function InlineTextarea({
  value,
  onSave,
  editable,
  placeholder = "Empty",
  maxLength,
}: {
  value: string;
  onSave: (v: string) => void;
  editable: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [editingNow, setEditingNow] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    setEditingNow(false);
    if (draft.trim() !== value.trim()) onSave(draft.trim());
  };
  const rows = Math.min(16, Math.max(3, (draft || "").split("\n").length + 1));

  if (editable && editingNow) {
    return (
      <div className="-mx-2">
        <textarea
          autoFocus
          value={draft}
          rows={rows}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditingNow(false);
            }
          }}
          placeholder={placeholder}
          className="w-full resize-y rounded-md bg-muted px-2 py-1.5 text-sm leading-relaxed outline-none ring-1 ring-ring/40"
        />
        {maxLength && (
          <div className={cn("px-2 text-right text-[11px] tabular", draft.length > maxLength ? "text-rose-600" : "text-muted-foreground/70")}>
            {draft.length}/{maxLength}
          </div>
        )}
      </div>
    );
  }
  const display = value ? (
    <span className="whitespace-pre-wrap leading-relaxed">{value}</span>
  ) : (
    <Empty>{placeholder}</Empty>
  );
  if (!editable) return <div className="min-h-8 py-1.5 text-sm">{display}</div>;
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditingNow(true);
      }}
      className={cn(rowButton, "cursor-text py-1.5")}
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

/**
 * Date + time variant. `value` is a "YYYY-MM-DDTHH:mm" wall-clock string (the caller converts
 * to/from the workspace timezone). Clicking the row opens the native picker.
 */
export function DateTimeValue({
  value,
  onChange,
  editable,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  label: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  if (!editable) return <div className="flex min-h-8 items-center text-sm">{label}</div>;
  return (
    <label
      className="relative flex min-h-8 cursor-pointer items-center rounded-md px-2 -mx-2 text-sm hover:bg-muted"
      onClick={() => {
        try {
          ref.current?.showPicker?.();
        } catch {
          /* browsers without showPicker fall back to the native click */
        }
      }}
    >
      {label}
      <input
        ref={ref}
        type="datetime-local"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Date and time"
      />
    </label>
  );
}
