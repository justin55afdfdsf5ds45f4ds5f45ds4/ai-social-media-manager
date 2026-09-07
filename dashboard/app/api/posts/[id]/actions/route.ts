import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { UserError } from "@/lib/errors";
import { approve, cancelRemote, publishNow, reject, unreject } from "@/lib/publish";
import type { PostAction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Body: { action: "approve" | "publish" | "reject" | "cancel" | "unreject" } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { action } = (await req.json()) as { action: PostAction };
    switch (action) {
      case "approve":
        return NextResponse.json(await approve(id));
      case "publish":
        return NextResponse.json(await publishNow(id));
      case "reject":
        return NextResponse.json(await reject(id));
      case "cancel":
        return NextResponse.json(await cancelRemote(id));
      case "unreject":
        return NextResponse.json(await unreject(id));
      default:
        throw new UserError(`Unknown action "${String(action)}"`);
    }
  } catch (err) {
    return handleError(err);
  }
}
