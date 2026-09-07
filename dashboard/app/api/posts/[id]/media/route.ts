import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { UserError } from "@/lib/errors";
import { postDir } from "@/lib/paths";
import { attachMedia, removeMedia } from "@/lib/submit";
import type { MediaKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Upload a reel or cover from the browser. multipart/form-data with fields:
 *   file  – the file
 *   kind  – "video" | "cover" (defaults by MIME type)
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  let tmp: string | null = null;
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) throw new UserError("No file received.");
    const kindField = fd.get("kind");
    const kind: MediaKind =
      kindField === "cover" || kindField === "video"
        ? kindField
        : file.type.startsWith("image/")
          ? "cover"
          : "video";

    const ext = path.extname(file.name).toLowerCase() || (kind === "cover" ? ".jpg" : ".mp4");
    const dir = postDir(id);
    await fs.mkdir(dir, { recursive: true });
    // Leading dot keeps the temp file invisible to the media GET route.
    tmp = path.join(dir, `.upload-${Date.now()}${ext}`);
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));

    const post = await attachMedia(id, { kind, srcPath: tmp, move: true });
    tmp = null;
    return NextResponse.json(post);
  } catch (err) {
    if (tmp) await fs.rm(tmp, { force: true }).catch(() => {});
    return handleError(err);
  }
}

/** Remove the reel (?kind=video, post goes back to planned) or the cover (?kind=cover). */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const kind = new URL(req.url).searchParams.get("kind") === "cover" ? "cover" : "video";
    return NextResponse.json(await removeMedia(id, kind));
  } catch (err) {
    return handleError(err);
  }
}
