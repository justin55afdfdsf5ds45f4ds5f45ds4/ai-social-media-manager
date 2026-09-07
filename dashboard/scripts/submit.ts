/**
 * Add a finished reel to the review queue, or fill a planned slot.
 *
 *   npm run submit -- --video path/to/reel.mp4 --caption-file caption.txt [options]
 *   npm run submit -- --video reel.mp4 --into 20260906-ab12cd            (fill a planned slot)
 *
 * Options
 *   --video <file>          required. H.264 MP4, 9:16, 3s–15min
 *   --caption <text>        caption (prefer --caption-file <file>, UTF-8, keeps emoji intact)
 *   --into <id>             fill an existing planned slot instead of creating a new post
 *   --title <text>          short label for the calendar (defaults to first caption line)
 *   --first-comment <text>  posted as the first comment (links go here)
 *   --cover <image>         optional JPG/PNG cover
 *   --notes <text>          notes shown on the post page (topic, source voiceover…)
 *   --at "YYYY-MM-DD HH:mm" schedule at this wall-clock time in the configured timezone
 *   --asap                  schedule for now (still waits for approval)
 *   --random                random slot in the next week (default for new posts)
 *   --move                  move the source file instead of copying
 *   --approve               skip review: schedule on Blotato immediately
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { approve } from "../lib/publish";
import { loadSettings } from "../lib/settings";
import { submitReel } from "../lib/submit";
import { formatInTz } from "../lib/time";

const { values } = parseArgs({
  options: {
    video: { type: "string" },
    caption: { type: "string" },
    "caption-file": { type: "string" },
    into: { type: "string" },
    title: { type: "string" },
    "first-comment": { type: "string" },
    cover: { type: "string" },
    notes: { type: "string" },
    at: { type: "string" },
    asap: { type: "boolean", default: false },
    random: { type: "boolean", default: false },
    move: { type: "boolean", default: false },
    approve: { type: "boolean", default: false },
  },
});

// npm sets INIT_CWD to where the user typed the command; resolve relative paths from there.
const base = process.env.INIT_CWD ?? process.cwd();
const resolve = (p?: string) => (p ? path.resolve(base, p) : undefined);

async function main() {
  if (!values.video) throw new Error("--video is required");
  const caption =
    values.caption ?? (values["caption-file"] ? readFileSync(resolve(values["caption-file"])!, "utf8") : undefined);

  const schedule = values.at ? values.at : values.asap ? "asap" : values.into ? undefined : "random";

  const post = await submitReel({
    videoPath: resolve(values.video)!,
    caption,
    into: values.into,
    title: values.title,
    firstComment: values["first-comment"],
    coverPath: resolve(values.cover),
    notes: values.notes,
    schedule,
    move: values.move,
  });

  const settings = await loadSettings();
  console.log(`${values.into ? "Filled" : "Submitted"} ${post.id}`);
  console.log(`  title:     ${post.title}`);
  console.log(`  scheduled: ${formatInTz(post.scheduledAt!, settings.timezone, true)} (${settings.timezone}, ${post.scheduleSource})`);
  console.log(`  media:     content/posts/${post.id}/${post.media?.video}`);
  console.log(`  status:    ${post.status}`);

  if (values.approve) {
    const approved = await approve(post.id);
    console.log(`Approved → Blotato submission ${approved.blotato?.postSubmissionId}`);
  } else {
    console.log("Open the dashboard → Calendar to review and approve.");
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
