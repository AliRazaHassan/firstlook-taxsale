import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "firstlook",
    time: new Date().toISOString(),
    capabilities: {
      database: databaseConfigured() ? "configured" : "not-configured",
      countyWatchRegistration: databaseConfigured() ? "persistent" : "disabled",
      alertDelivery: "worker-not-configured",
    },
  });
}
