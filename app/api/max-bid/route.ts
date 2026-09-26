import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateMaxBid } from "@/lib/engine";

export const runtime = "nodejs";

const Money = z.coerce.number().finite().min(0).max(100_000_000);
const Percent = z.coerce.number().finite().min(0).max(1);
const MaxBidSchema = z.object({
  arv: Money,
  rehab: Money.default(0),
  holdingMonths: z.coerce.number().int().min(0).max(120).default(4),
  monthlyHolding: Money.default(500),
  closingBuyPct: Percent.default(0.02),
  closingSellPct: Percent.default(0.06),
  desiredProfit: Money.optional(),
  contingency: Money.optional(),
  cryOutBid: Money.optional(),
});

export async function POST(request: Request) {
  try {
    const body = MaxBidSchema.parse(await request.json());
    return NextResponse.json(calculateMaxBid(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
