import { NextResponse } from "next/server";
import {
  BuyBoxSchema,
  DEFAULT_BUY_BOX,
  impactStats,
  normalizeBuyBox,
  rescoreExisting,
  type ScoredProperty,
} from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      properties?: ScoredProperty[];
      buyBox?: unknown;
      bidDefaults?: {
        rehab?: number;
        holdingMonths?: number;
        monthlyHolding?: number;
        desiredProfitPct?: number;
      };
    };

    if (!body.properties?.length) {
      return NextResponse.json({ error: "properties required" }, { status: 400 });
    }

    const buyBox = normalizeBuyBox(body.buyBox ?? DEFAULT_BUY_BOX);
    // Keep schema export warm / validate shape
    BuyBoxSchema.parse(buyBox);

    const properties = rescoreExisting(body.properties, buyBox, body.bidDefaults);
    const impact = impactStats(properties);

    return NextResponse.json({
      mode: "rescored",
      total: properties.length,
      lookFirstCount: impact.lookFirst,
      geocoded: properties.filter((p) => p.geocodeStatus === "matched").length,
      impact,
      properties,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rescore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
