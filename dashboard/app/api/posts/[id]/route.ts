import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { postDir } from "@/lib/paths";
import { UserError } from "@/lib/errors";
import { applyPatch, cancelRemote } from "@/lib/publish";
import { NotFoundError } from "@/lib/errors";
import { getPost, removePost } from "@/lib/store";
import type { PostPatch } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) throw new NotFoundError(`Post ${id} not found`);
    return NextResponse.json(post);
  } catch (err) {
    return handleError(err);
  }
}

/** Edit caption, first comment, title, notes or schedule. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = (await req.json()) as PostPatch;
    return NextResponse.json(await applyPatch(id, patch));
  } catch (err) {
    return handleError(err);
  }
}

/** Delete a post and its media folder. Scheduled posts are pulled off Blotato first. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) throw new NotFoundError(`Post ${id} not found`);
    if (post.status === "publishing") throw new UserError("Wait for publishing to finish.");
    if (post.status === "approved") await cancelRemote(id, false);
    await removePost(id);
    await fs.rm(postDir(id), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
