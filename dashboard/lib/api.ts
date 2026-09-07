import { NextResponse } from "next/server";
import { BlotatoError } from "./blotato";
import { NotFoundError, UserError } from "./errors";

/** Uniform error → HTTP mapping for route handlers. */
export function handleError(err: unknown) {
  if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  if (err instanceof BlotatoError) {
    return NextResponse.json(
      { error: `Blotato: ${err.message}`, blotatoStatus: err.status, detail: err.body },
      { status: err.status >= 500 ? 502 : 400 },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
