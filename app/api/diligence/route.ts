import { NextResponse } from "next/server";
import {
  buildDiligenceChecklist,
  overbidRisk,
  resolveCountyRules,
  valuationConfidence,
  type ScoredProperty,
} from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { property?: ScoredProperty };
    if (!body.property) {
      return NextResponse.json({ error: "property required" }, { status: 400 });
    }
    const p = body.property;
    const rules = resolveCountyRules(p.state, p.county);
    return NextResponse.json({
      rules,
      checklist: buildDiligenceChecklist(p, rules),
      valuation: valuationConfidence(p),
      overbid: overbidRisk(p),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Diligence failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const { COUNTY_RULES } = await import("@/lib/engine");
  return NextResponse.json({ counties: COUNTY_RULES });
}
