import { NextResponse } from "next/server";
import demoResults from "@/data/demo-results.json";
import { attachMaxBids, impactStats, type ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  const withBids = attachMaxBids(demoResults as ScoredProperty[]);
  const impact = impactStats(withBids);

  return NextResponse.json({
    mode: "demo",
    phase: 2,
    county: "Clayton County, GA",
    saleDate: "07/07/2026",
    total: withBids.length,
    lookFirstCount: impact.lookFirst,
    geocoded: withBids.filter((p) => p.geocodeStatus === "matched").length,
    impact,
    properties: withBids,
  });
}
