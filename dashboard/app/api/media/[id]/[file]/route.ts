import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { mimeFor } from "@/lib/blotato";
import { postDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; file: string }> };

/**
 * Streams a post's local media (video/cover) to the browser with Range support,
 * so the <video> element can seek. Path segments are sanitised to the post folder.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id, file } = await params;
  if (!/^[\w-]+$/.test(id) || file !== path.basename(file) || file.startsWith(".")) {
    return new NextResponse("Bad path", { status: 400 });
  }
  const abs = path.join(postDir(id), file);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat?.isFile()) return new NextResponse("Not found", { status: 404 });

  const size = stat.size;
  const type = mimeFor(file);
  const range = req.headers.get("range");

  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m?.[1] ? parseInt(m[1], 10) : 0;
    let end = m?.[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    start = Math.max(0, start);
    const stream = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
