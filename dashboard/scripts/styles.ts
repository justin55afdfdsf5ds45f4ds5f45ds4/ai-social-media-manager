/** Print the registered styles (docs/styles.json). A style is referred to by id or name. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../lib/paths";

type Style = { id: string; name: string; engine: { kind: string; path: string; fps: number; size: string }; status: string; sheet: string };

const file = path.join(WORKSPACE_ROOT, "docs", "styles.json");
const { styles } = JSON.parse(readFileSync(file, "utf8")) as { styles: Style[] };

console.log("id    name      engine                 size        status");
for (const s of styles) {
  console.log(`${s.id.padEnd(5)} ${s.name.padEnd(9)} ${s.engine.kind.padEnd(22)} ${s.engine.size.padEnd(11)} ${s.status}`);
}
console.log(`\nSheets: ${styles.map((s) => s.sheet).join(", ")}\nSay "make it in <id or name>".`);
