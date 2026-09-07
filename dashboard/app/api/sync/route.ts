import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { syncAll } from "@/lib/publish";

export const dynamic = "force-dynamic";

/** Ask Blotato for the current status of every post waiting on it. */
export async function POST() {
  try {
    return NextResponse.json(await syncAll());
  } catch (err) {
    return handleError(err);
  }
}
