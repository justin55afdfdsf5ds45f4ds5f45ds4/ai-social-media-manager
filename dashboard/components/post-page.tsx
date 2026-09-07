"use client";

import {
  AlertTriangle,
  CalendarDays,
  Dices,
  Ellipsis,
  Film,
  Link as LinkIcon,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Plus,
  Text,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { client } from "@/lib/client";
import { STATUSES } from "@/lib/status";
import { formatInTz, fromDateTimeInput, isFuture, toDateTimeInput } from "@/lib/time";
import type { MediaKind, Post, PostAction, PostPatch, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Modal } from "./modal";
import { DateTimeValue, Empty, InlineText, InlineTextarea, PillSelect, PropRow, useMenu } from "./properties";

type Props = {
  post: Post | null;
  tz: string;
  busy: boolean;
  onClose: () => void;
  onSave: (id: string, patch: PostPatch) => Promise<void>;
  onAction: (id: string, action: PostAction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpload: (id: string, file: File, kind: MediaKind, onProgress: (pct: number) => void) => Promise<void>;
  onRemoveFile: (id: string, kind: MediaKind) => Promise<void>;
};

/** The page that opens when you click a calendar chip. Centered dialog, Notion-style rows. */
export function PostPage(props: Props) {
  return (
    <Modal open={props.post !== null} onClose={props.onClose}>
      {props.post && <Body key={props.post.id} {...props} post={props.post} />}
    </Modal>
  );
}

function Body({ post, tz, busy, onClose, onSave, onAction, onDelete, onUpload, onRemoveFile }: Props & { post: Post }) {
  const [isPending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<PostPatch>({});
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const menu = useMenu();
  const fileInput = useRef<HTMLInputElement>(null);

  // Optimistic while a save is in flight; server data wins afterwards.
  const view: Post = isPending ? mergePatch(post, optimistic) : post;
  const save = (patch: PostPatch) => {
    setOptimistic((o) => ({ ...o, ...patch }));
    start(async () => {
      await onSave(post.id, patch);
    });
  };

  const s = view.status;
  const editing = s !== "posted" && s !== "publishing";
  const locked = busy || isPending;
  const future = view.scheduledAt ? isFuture(view.scheduledAt) : false;
  const hasReel = !!view.media;

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const file = list[0];
    const kind: MediaKind = file.type.startsWith("image/") ? "cover" : "video";
    setUpload({ name: file.name, pct: 0 });
    try {
      await onUpload(post.id, file, kind, (pct) => setUpload({ name: file.name, pct }));
    } finally {
      setUpload(null);
    }
  }

  const iconBtn = "grid size-7 place-items-center rounded-md hover:bg-muted";
  const videoUrl = view.media ? client.mediaUrl(post.id, view.media.video) : null;
  const coverUrl = view.media?.cover ? client.mediaUrl(post.id, view.media.cover) : null;

  return (
    <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex h-10 items-center justify-end gap-0.5 bg-background/90 px-2 backdrop-blur">
        {(isPending || busy) && <span className="mr-2 text-[11px] text-muted-foreground">Saving…</span>}
        <div className="relative" ref={menu.ref}>
          <button type="button" onClick={() => menu.setOpen((m) => !m)} className={iconBtn} aria-label="More">
            <Ellipsis className="size-4" />
          </button>
          {menu.open && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-44 rounded-lg bg-background p-1 shadow-md ring-1 ring-foreground/10">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    menu.setOpen(false);
                    save({ scheduledAt: "random" });
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                >
                  <Dices className="size-4" /> Pick a random slot
                </button>
              )}
              {s !== "publishing" && (
                <button
                  type="button"
                  onClick={() => {
                    menu.setOpen(false);
                    if (confirm(`Delete "${post.title || "this post"}" and its files?`)) onDelete(post.id).then(onClose);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-10 pb-12 pt-2 md:px-14">
        {/* Title */}
        {editing ? (
          <TitleInput value={post.title} onSave={(t) => save({ title: t })} />
        ) : (
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            {post.title || <span className="text-muted-foreground/60">Untitled</span>}
          </h1>
        )}

        {/* Decision bar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(s === "needs_review" || s === "failed") && (
            <>
              <Btn primary disabled={locked || !future} onClick={() => onAction(post.id, "approve")} title={future ? "Upload to Blotato and schedule it" : "Pick a future time first"}>
                {s === "failed" ? "Retry at schedule" : "Approve"}
              </Btn>
              <Btn disabled={locked} onClick={() => confirm("Post this reel to Instagram right now?") && onAction(post.id, "publish")}>
                Post now
              </Btn>
              <Btn disabled={locked} onClick={() => onAction(post.id, "reject")}>
                Reject
              </Btn>
            </>
          )}
          {s === "draft" && (
            <span className="text-[12px] text-muted-foreground">
              Planned slot. Attach a reel below, or leave a brief in Notes for the AI to fill it.
            </span>
          )}
          {s === "approved" && (
            <>
              <span className="mr-1 text-[12px] text-muted-foreground">On Blotato&apos;s queue. Posts automatically at the scheduled time.</span>
              <Btn disabled={locked} onClick={() => confirm("Post right now instead of waiting?") && onAction(post.id, "publish")}>
                Post now
              </Btn>
              <Btn disabled={locked} onClick={() => onAction(post.id, "cancel")} title="Remove from Blotato's queue and go back to review">
                Cancel schedule
              </Btn>
            </>
          )}
          {s === "rejected" && (
            <Btn primary disabled={locked} onClick={() => onAction(post.id, "unreject")}>
              Reopen
            </Btn>
          )}
          {s === "publishing" && <span className="text-[12px] text-muted-foreground">Publishing… Instagram is processing the reel.</span>}
          {s === "posted" && <span className="text-[12px] text-muted-foreground">Live on Instagram.</span>}
        </div>

        {/* Properties */}
        <div className="mt-5 grid gap-y-0.5">
          <PropRow icon={<ListChecks />} label="Status">
            <PillSelect<PostStatus>
              value={s}
              editable={false}
              onChange={() => {}}
              options={STATUSES.map((x) => ({ value: x.value, label: x.label, pill: x.pill }))}
            />
          </PropRow>

          <PropRow icon={<CalendarDays />} label="Post date">
            <DateTimeValue
              editable={editing}
              value={view.scheduledAt ? toDateTimeInput(view.scheduledAt, tz) : ""}
              onChange={(v) => save({ scheduledAt: fromDateTimeInput(v, tz) })}
              label={
                view.scheduledAt ? (
                  <span className="tabular">
                    {formatInTz(view.scheduledAt, tz, true)}
                    {!future && editing && <span className="ml-2 text-amber-600 dark:text-amber-300">in the past</span>}
                    <span className="ml-2 text-muted-foreground/70">{view.scheduleSource}</span>
                  </span>
                ) : (
                  <Empty />
                )
              }
            />
          </PropRow>

          <PropRow icon={<Text />} label="Caption">
            <InlineTextarea
              value={view.caption}
              editable={editing}
              maxLength={2200}
              placeholder="Empty"
              onSave={(v) => save({ caption: v })}
            />
          </PropRow>

          <PropRow icon={<MessageSquare />} label="First comment">
            <InlineText
              value={view.firstComment ?? ""}
              editable={editing}
              placeholder="Empty · links go here"
              onSave={(v) => save({ firstComment: v })}
            />
          </PropRow>

          <PropRow icon={<Film />} label="Reel">
            <div className="flex min-h-8 flex-wrap items-center gap-1.5 py-1">
              {view.media && (
                <FileChip
                  name={view.media.video}
                  href={videoUrl!}
                  meta={[
                    view.media.width && view.media.height ? `${view.media.width}×${view.media.height}` : null,
                    view.media.durationSec ? `${view.media.durationSec}s` : null,
                    view.media.sizeBytes ? `${(view.media.sizeBytes / 1048576).toFixed(1)} MB` : null,
                  ]}
                  onRemove={editing && s !== "approved" ? () => confirm("Remove the reel? The post goes back to Planned.") && onRemoveFile(post.id, "video") : undefined}
                />
              )}
              {view.media?.cover && (
                <FileChip
                  name={view.media.cover}
                  href={coverUrl!}
                  thumb={coverUrl!}
                  onRemove={editing && s !== "approved" ? () => confirm("Remove the cover?") && onRemoveFile(post.id, "cover") : undefined}
                />
              )}
              {upload && (
                <span className="inline-flex h-6 items-center gap-1.5 rounded border border-dashed px-1.5 text-xs text-muted-foreground">
                  {upload.name} · {upload.pct}%
                </span>
              )}
              {editing && s !== "approved" && !upload && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="video/mp4,video/quicktime,image/jpeg,image/png"
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
                    title={hasReel ? "Replace the reel, or add a JPG/PNG cover" : "Upload an H.264 MP4, 1080×1920"}
                  >
                    <Plus className="size-3" /> {hasReel ? "Add cover / replace" : "Upload reel"}
                  </button>
                </>
              )}
              {!editing && !view.media && <Empty />}
            </div>
          </PropRow>

          <PropRow icon={<NotebookPen />} label="Notes">
            <InlineTextarea
              value={view.notes ?? ""}
              editable={editing}
              placeholder={s === "draft" ? "Brief for the AI: topic, hook, voiceover to use…" : "Empty"}
              onSave={(v) => save({ notes: v })}
            />
          </PropRow>

          {view.blotato?.publicUrl && (
            <PropRow icon={<LinkIcon />} label="Post link">
              <InlineText url value={view.blotato.publicUrl} editable={false} onSave={() => {}} />
            </PropRow>
          )}

          {s === "failed" && (
            <PropRow icon={<AlertTriangle />} label="Error">
              <div className="min-h-8 py-1.5 text-sm text-rose-700 dark:text-rose-300">
                {view.blotato?.errorMessage ?? "Blotato reported a failure."}
              </div>
            </PropRow>
          )}
        </div>

        {/* Media, large */}
        {videoUrl && (
          <div className="mt-6 space-y-4 border-t pt-6">
            <figure className="overflow-hidden rounded-lg border bg-muted">
              <div
                className="relative mx-auto w-full"
                style={{
                  aspectRatio:
                    view.media?.width && view.media?.height ? `${view.media.width} / ${view.media.height}` : "9 / 16",
                  maxHeight: "70vh",
                  maxWidth:
                    view.media?.width && view.media?.height && view.media.height > view.media.width
                      ? `calc(70vh * ${view.media.width} / ${view.media.height})`
                      : "calc(70vh * 9 / 16)",
                }}
              >
                <video
                  key={videoUrl}
                  src={videoUrl}
                  poster={coverUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                />
              </div>
              <figcaption className="flex items-center justify-between border-t bg-background px-3 py-1.5 text-xs text-muted-foreground">
                <span className="truncate">{view.media?.video}</span>
                <a href={videoUrl} download={`${post.id}-${view.media?.video}`} className="shrink-0 hover:text-foreground">
                  Download
                </a>
              </figcaption>
            </figure>
          </div>
        )}

        {view.scheduledAt && (
          <p className="mt-8 text-xs text-muted-foreground">
            {s === "posted" ? "Posted" : "Scheduled for"} {formatInTz(view.scheduledAt, tz, true)} · {tz}
          </p>
        )}
        {post.history.length > 0 && <History post={post} tz={tz} />}
      </div>
    </div>
  );
}

function mergePatch(post: Post, patch: PostPatch): Post {
  const { scheduledAt, ...rest } = patch;
  return {
    ...post,
    ...rest,
    firstComment: rest.firstComment !== undefined ? rest.firstComment || undefined : post.firstComment,
    notes: rest.notes !== undefined ? rest.notes || undefined : post.notes,
    scheduledAt: scheduledAt && scheduledAt !== "random" ? scheduledAt : post.scheduledAt,
  };
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

function FileChip({
  name,
  href,
  thumb,
  meta,
  onRemove,
}: {
  name: string;
  href: string;
  thumb?: string;
  meta?: (string | null)[];
  onRemove?: () => void;
}) {
  const info = meta?.filter(Boolean).join(" · ");
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1.5 rounded border bg-background pl-1 pr-1.5 text-xs">
      <span className="relative size-4 shrink-0 overflow-hidden rounded-[3px] bg-muted">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
      </span>
      <a href={href} target="_blank" rel="noreferrer" className="truncate underline-offset-2 hover:underline">
        {name}
      </a>
      {info && <span className="text-muted-foreground tabular">{info}</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 text-muted-foreground hover:text-red-600" aria-label={`Remove ${name}`}>
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function History({ post, tz }: { post: Post; tz: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">
        {open ? "▾" : "▸"} History
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
          {[...post.history].reverse().map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 tabular">{formatInTz(h.at, tz)}</span>
              <span className="text-foreground">{h.event}</span>
              {h.detail && <span className="truncate">{h.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary ? "bg-foreground text-background hover:opacity-90" : "border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
