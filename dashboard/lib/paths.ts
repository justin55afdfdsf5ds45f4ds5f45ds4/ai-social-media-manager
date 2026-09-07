import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * The workspace root is the folder that holds `data/`, `content/`, `brand/` and `.env`.
 * The dashboard lives one level below it. We detect it by looking for `dashboard/package.json`
 * from the current directory upwards, so scripts work from either folder.
 * Override with WORKSPACE_ROOT if you move things.
 */
function findRoot(): string {
  if (process.env.WORKSPACE_ROOT) return path.resolve(process.env.WORKSPACE_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (existsSync(path.join(dir, "dashboard", "package.json")) && existsSync(path.join(dir, "data"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), "..");
}

export const WORKSPACE_ROOT = findRoot();

loadDotenv({ path: path.join(WORKSPACE_ROOT, ".env"), quiet: true });

export const DATA_DIR = path.join(WORKSPACE_ROOT, "data");
export const CONTENT_DIR = path.join(WORKSPACE_ROOT, "content");
export const POSTS_DIR = path.join(CONTENT_DIR, "posts");
export const INBOX_DIR = path.join(CONTENT_DIR, "inbox");
export const BRAND_DIR = path.join(WORKSPACE_ROOT, "brand");
export const POSTS_FILE = path.join(DATA_DIR, "posts.json");
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export function postDir(id: string) {
  return path.join(POSTS_DIR, id);
}

export function requireEnv(name: "BLOTATO_API_KEY" | "INSTAGRAM_ACCOUNT_ID"): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Add it to ${path.join(WORKSPACE_ROOT, ".env")} (see .env.example).`,
    );
  }
  return v.trim();
}
