import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseConfigured, ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";
const SaveSchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  label: z.string().trim().min(1).max(100).default("Research session"),
  payload: z.unknown(),
});

export async function POST(request: Request) {
  try {
    if (!databaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    const body = SaveSchema.parse(await request.json());
    const serialized = JSON.stringify(body.payload);
    if (Buffer.byteLength(serialized, "utf8") > 2_000_000) return NextResponse.json({ error: "Session payload exceeds 2 MB" }, { status: 413 });
    await ensureSchema();
    const id = randomUUID();
    await getDb().query(
      "INSERT INTO research_sessions (id, email, label, payload) VALUES ($1, $2, $3, $4::jsonb)",
      [id, body.email?.toLowerCase() ?? null, body.label, serialized],
    );
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
