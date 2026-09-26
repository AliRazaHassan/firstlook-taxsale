import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const WatchSchema = z.object({
  email: z.string().trim().email().max(254),
  county: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(30),
});

/**
 * Phase 4 interest endpoint.
 * IMPORTANT: this does not pretend to persist or send alerts until a database + worker are configured.
 */
export async function POST(request: Request) {
  try {
    const row = WatchSchema.parse(await request.json());
    return NextResponse.json(
      {
        ok: false,
        status: "pending-infrastructure",
        message: `County Watch for ${row.county}, ${row.state.toUpperCase()} is not active yet. Persistent storage and the alert worker must be configured before registrations can be accepted.`,
      },
      { status: 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid watch request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
