/** Refresh the status of every post that is waiting on Blotato. */
import { syncAll } from "../lib/publish";

syncAll()
  .then((r) => {
    console.log(`Checked ${r.checked} post(s); ${r.changed.length} changed${r.changed.length ? `: ${r.changed.join(", ")}` : ""}.`);
  })
  .catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
