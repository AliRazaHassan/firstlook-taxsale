import { NextResponse } from "next/server";
import demoResults from "@/data/demo-results.json";
import { attachMaxBids } from "@/lib/engine";
import type { ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  const withBids = attachMaxBids(demoResults as ScoredProperty[]);
  const lookFirst = withBids.filter((p) => p.lookAtFirst);

  return NextResponse.json({
    mode: "demo",
    county: "Clayton County, GA",
    saleDate: "07/07/2026",
    total: withBids.length,
    lookFirstCount: lookFirst.length,
    geocoded: withBids.filter((p) => p.geocodeStatus === "matched").length,
    properties: withBids,
  });
}
