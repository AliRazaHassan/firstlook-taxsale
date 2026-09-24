import { NextResponse } from "next/server";
import { propertiesToCsv } from "@/lib/engine";
import type { ScoredProperty } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { properties?: ScoredProperty[] };
    if (!body.properties?.length) {
      return NextResponse.json({ error: "No properties to export" }, { status: 400 });
    }
    const csv = propertiesToCsv(body.properties);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="firstlook-taxsale-research.csv"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
