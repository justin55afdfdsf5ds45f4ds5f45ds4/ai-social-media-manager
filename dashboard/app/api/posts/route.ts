import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { blotato } from "@/lib/blotato";
import { loadSettings } from "@/lib/settings";
import { listPosts } from "@/lib/store";
import { createDraft, submitReel, type SubmitInput } from "@/lib/submit";
import type { AccountInfo, CreateDraftInput, Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

let accountCache: { at: number; value: AccountInfo | null } | null = null;

async function getAccount(): Promise<{ account: AccountInfo | null; error?: string }> {
  if (accountCache && Date.now() - accountCache.at < 10 * 60_000) {
    return { account: accountCache.value };
  }
  try {
    const wanted = process.env.INSTAGRAM_ACCOUNT_ID?.trim();
    const accounts = await blotato.accounts("instagram");
    const account = accounts.find((a) => a.id === wanted) ?? accounts[0] ?? null;
    accountCache = { at: Date.now(), value: account };
    return { account };
  } catch (err) {
    return { account: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Snapshot for the dashboard: queue + settings + connected account. */
export async function GET() {
  try {
    const [posts, settings, acc] = await Promise.all([listPosts(), loadSettings(), getAccount()]);
    const body: Snapshot = { posts, settings, account: acc.account, ...(acc.error ? { error: acc.error } : {}) };
    return NextResponse.json(body);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Create a post.
 *  - `{ kind: "draft", date }`   → empty planned slot on that day (calendar click / New)
 *  - `{ videoPath, caption, … }` → same as `npm run submit`
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDraftInput | SubmitInput;
    const post =
      "kind" in body && body.kind === "draft" ? await createDraft(body) : await submitReel(body as SubmitInput);
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
