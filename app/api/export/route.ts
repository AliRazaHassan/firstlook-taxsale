import { NextResponse } from "next/server";
import { CSV_TEMPLATE, propertiesToBidSheet, propertiesToCsv } from "@/lib/engine";
import type { ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="firstlook-taxsale-template.csv"',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      properties?: ScoredProperty[];
      format?: "full" | "bid-sheet";
    };
    if (!body.properties?.length) {
      return NextResponse.json({ error: "No properties to export" }, { status: 400 });
    }

    const format = body.format ?? "full";
    const csv =
      format === "bid-sheet"
        ? propertiesToBidSheet(body.properties)
        : propertiesToCsv(body.properties);
    const filename =
      format === "bid-sheet" ? "firstlook-auction-bid-sheet.csv" : "firstlook-research.csv";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
