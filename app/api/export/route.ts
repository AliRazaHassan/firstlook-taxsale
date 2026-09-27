import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { CSV_TEMPLATE, propertiesToBidSheet, propertiesToCsv } from "@/lib/engine";
import type { ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";
const MAX_EXPORT_PROPERTIES = 1000;

export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="firstlook-taxsale-template.csv"', "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "export", 60, 600000);
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  try {
    const body = (await request.json()) as { properties?: ScoredProperty[]; format?: "full" | "bid-sheet" };
    if (!body.properties?.length) return NextResponse.json({ error: "No properties to export" }, { status: 400 });
    if (body.properties.length > MAX_EXPORT_PROPERTIES) {
      return NextResponse.json({ error: `Maximum ${MAX_EXPORT_PROPERTIES} properties per export.` }, { status: 413 });
    }
    if (body.format && body.format !== "full" && body.format !== "bid-sheet") {
      return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
    }
    const format = body.format ?? "full";
    const csv = format === "bid-sheet" ? propertiesToBidSheet(body.properties) : propertiesToCsv(body.properties);
    const filename = format === "bid-sheet" ? "firstlook-auction-bid-sheet.csv" : "firstlook-research.csv";
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
