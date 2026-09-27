import { NextResponse } from "next/server";
import { BuyBoxSchema, DEFAULT_BUY_BOX, impactStats, normalizeBuyBox, rescoreExisting, type ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";
const MAX_PROPERTIES = 100;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      properties?: ScoredProperty[];
      buyBox?: unknown;
      bidDefaults?: { rehab?: number; holdingMonths?: number; monthlyHolding?: number; desiredProfitPct?: number; closingBuyPct?: number; closingSellPct?: number; contingencyPct?: number; titleLegal?: number; survivingLiens?: number; evictionPossession?: number; auctionFees?: number; redemptionCarry?: number };
    };
    if (!body.properties?.length) return NextResponse.json({ error: "properties required" }, { status: 400 });
    if (body.properties.length > MAX_PROPERTIES) {
      return NextResponse.json({ error: `Maximum ${MAX_PROPERTIES} properties per rescore request.` }, { status: 413 });
    }
    const buyBox = normalizeBuyBox(body.buyBox ?? DEFAULT_BUY_BOX);
    BuyBoxSchema.parse(buyBox);
    const properties = rescoreExisting(body.properties, buyBox, body.bidDefaults);
    const impact = impactStats(properties);
    return NextResponse.json({
      mode: "rescored", total: properties.length, lookFirstCount: impact.lookFirst,
      geocoded: properties.filter((p) => p.geocodeStatus === "matched").length, impact, properties,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rescore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
