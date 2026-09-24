import { NextResponse } from "next/server";
import { calculateMaxBid } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = calculateMaxBid({
      arv: Number(body.arv) || 0,
      rehab: Number(body.rehab) || 0,
      holdingMonths: Number(body.holdingMonths) || 4,
      monthlyHolding: Number(body.monthlyHolding) || 500,
      closingBuyPct: Number(body.closingBuyPct) || 0.02,
      closingSellPct: Number(body.closingSellPct) || 0.06,
      desiredProfit: body.desiredProfit != null ? Number(body.desiredProfit) : undefined,
      contingency: body.contingency != null ? Number(body.contingency) : undefined,
      cryOutBid: body.cryOutBid != null ? Number(body.cryOutBid) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
