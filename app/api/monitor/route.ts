import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Phase 4 stub — stores monitor interest (no secrets). Expand to real county crawlers later. */
const WATCHES: Array<{ email: string; county: string; state: string; createdAt: string }> = [];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      county?: string;
      state?: string;
    };
    if (!body.email?.includes("@") || !body.county || !body.state) {
      return NextResponse.json({ error: "email, county, and state required" }, { status: 400 });
    }
    const row = {
      email: body.email.trim().toLowerCase(),
      county: body.county.trim(),
      state: body.state.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    WATCHES.push(row);
    return NextResponse.json({
      ok: true,
      message: `Watch registered for ${row.county}, ${row.state}. Phase 4 will email when new sale lists appear.`,
      totalWatches: WATCHES.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Watch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
