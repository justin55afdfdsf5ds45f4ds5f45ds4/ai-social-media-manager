/** Print the local queue. */
import { loadSettings } from "../lib/settings";
import { listPosts } from "../lib/store";
import { formatInTz } from "../lib/time";

async function main() {
  const [posts, settings] = await Promise.all([listPosts(), loadSettings()]);
  if (!posts.length) {
    console.log("Queue is empty.");
    return;
  }
  console.log(`${posts.length} post(s) · times in ${settings.timezone}\n`);
  for (const p of posts) {
    const when = p.scheduledAt ? formatInTz(p.scheduledAt, settings.timezone, true) : "unscheduled";
    console.log(`${p.status.padEnd(13)} ${p.id}  ${when.padEnd(28)} ${p.title}`);
    if (p.blotato?.publicUrl) console.log(`${"".padEnd(13)} ↳ ${p.blotato.publicUrl}`);
    if (p.blotato?.errorMessage) console.log(`${"".padEnd(13)} ↳ ${p.blotato.errorMessage}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
