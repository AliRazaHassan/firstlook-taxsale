import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

declare global {
  // eslint-disable-next-line no-var
  var __firstlookHealthCapabilitiesLogged: boolean | undefined;
}

export async function GET() {
  const capabilities = {
    database: databaseConfigured() ? "configured" : "not-configured",
    countyWatchRegistration: databaseConfigured() ? "persistent" : "disabled",
    alertDelivery: "worker-not-configured",
    aiConcierge: process.env.OPENAI_API_KEY ? "configured" : "missing-key",
    aiEngineer: process.env.FIRSTLOOK_ADMIN_KEY ? "configured" : "missing-admin-key",
    aiModel: process.env.OPENAI_CONCIERGE_MODEL || "gpt-4.1-mini",
  };

  if (!global.__firstlookHealthCapabilitiesLogged) {
    console.info("FirstLook runtime capabilities", capabilities);
    global.__firstlookHealthCapabilitiesLogged = true;
  }

  return NextResponse.json(
    {
      ok: true,
      service: "firstlook",
      time: new Date().toISOString(),
      capabilities,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
