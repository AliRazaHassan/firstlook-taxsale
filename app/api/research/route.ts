import { NextResponse } from "next/server";
import {
  BuyBoxSchema,
  DEFAULT_BUY_BOX,
  impactStats,
  parseTaxSaleCsv,
  researchProperties,
} from "@/lib/engine";
import { attachMaxBids } from "@/lib/engine/maxBid";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROPERTIES = 100;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      csv?: string;
      buyBox?: unknown;
      bidDefaults?: {
        rehab?: number;
        holdingMonths?: number;
        monthlyHolding?: number;
        desiredProfitPct?: number;
      };
    };

    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "CSV text is required" }, { status: 400 });
    }

    const properties = parseTaxSaleCsv(body.csv);
    if (properties.length > MAX_PROPERTIES) {
      return NextResponse.json(
        {
          error: `Phase 2 supports up to ${MAX_PROPERTIES} properties per run. You sent ${properties.length}.`,
        },
        { status: 400 },
      );
    }

    const buyBox = body.buyBox
      ? BuyBoxSchema.parse(body.buyBox)
      : BuyBoxSchema.parse(DEFAULT_BUY_BOX);

    let results = await researchProperties(properties, buyBox);
    if (body.bidDefaults) {
      results = attachMaxBids(results, body.bidDefaults);
    }
    const impact = impactStats(results);

    return NextResponse.json({
      mode: "live",
      phase: 2,
      total: results.length,
      lookFirstCount: impact.lookFirst,
      geocoded: results.filter((p) => p.geocodeStatus === "matched").length,
      impact,
      properties: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
