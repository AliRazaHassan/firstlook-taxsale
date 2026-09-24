import { NextResponse } from "next/server";
import { BuyBoxSchema, DEFAULT_BUY_BOX, parseTaxSaleCsv, researchProperties } from "@/lib/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROPERTIES = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      csv?: string;
      buyBox?: unknown;
    };

    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "CSV text is required" }, { status: 400 });
    }

    const properties = parseTaxSaleCsv(body.csv);
    if (properties.length > MAX_PROPERTIES) {
      return NextResponse.json(
        { error: `Phase 1 MVP supports up to ${MAX_PROPERTIES} properties. You sent ${properties.length}.` },
        { status: 400 },
      );
    }

    const buyBox = body.buyBox
      ? BuyBoxSchema.parse(body.buyBox)
      : BuyBoxSchema.parse(DEFAULT_BUY_BOX);

    const results = await researchProperties(properties, buyBox);

    return NextResponse.json({
      mode: "live",
      total: results.length,
      lookFirstCount: results.filter((p) => p.lookAtFirst).length,
      geocoded: results.filter((p) => p.geocodeStatus === "matched").length,
      properties: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
