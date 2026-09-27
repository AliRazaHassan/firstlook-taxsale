import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "firstlook",
      time: new Date().toISOString(),
      capabilities: {
        database: databaseConfigured() ? "configured" : "not-configured",
        countyWatchRegistration: databaseConfigured() ? "persistent" : "disabled",
        alertDelivery: "worker-not-configured",
        aiConcierge: process.env.OPENAI_API_KEY ? "configured" : "missing-key",
        aiEngineer: process.env.FIRSTLOOK_ADMIN_KEY ? "configured" : "missing-admin-key",
        aiModel: process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
