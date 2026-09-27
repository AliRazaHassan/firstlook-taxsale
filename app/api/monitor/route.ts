import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { z } from "zod";
import { databaseConfigured, ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";

const WatchSchema = z.object({
  email: z.string().trim().email().max(254),
  county: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(30),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "monitor", 10, 3600000);
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  try {
    const row = WatchSchema.parse(await request.json());
    if (!databaseConfigured()) {
      return NextResponse.json({ ok: false, status: "database-not-configured", message: "County Watch needs DATABASE_URL before registrations can be persisted." }, { status: 503 });
    }
    await ensureSchema();
    const db = getDb();
    await db.query(
      `INSERT INTO county_watches (email, county, state, active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email, county, state)
       DO UPDATE SET active=TRUE, updated_at=NOW()`,
      [row.email.toLowerCase(), row.county, row.state.toUpperCase()],
    );
    return NextResponse.json({
      ok: true,
      status: "registered",
      message: `Watch saved for ${row.county}, ${row.state.toUpperCase()}. Alert delivery becomes active when the county adapter/worker is configured.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid watch request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
