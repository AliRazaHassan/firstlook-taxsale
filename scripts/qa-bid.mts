import { BuyBoxSchema } from "../lib/engine/types";
import { DEFAULT_BUY_BOX } from "../lib/engine/buyBox";
import { rescoreExisting, impactStats } from "../lib/engine/rescore";
import { attachMaxBids, calculateMaxBid } from "../lib/engine/maxBid";
import demo from "../data/demo-results.json";

const r = calculateMaxBid({
  arv: 265660,
  rehab: 25000,
  holdingMonths: 4,
  monthlyHolding: 500,
  desiredProfit: Math.round(265660 * 0.15),
  cryOutBid: 10614,
});
console.log("calc", r.maxBid, r.projectedProfit);

const base = attachMaxBids(demo as any);
console.log("attach default", base[0].maxBid);

const parsed = BuyBoxSchema.parse(DEFAULT_BUY_BOX);
const hi = rescoreExisting(demo as any, parsed, {
  rehab: 40000,
  desiredProfitPct: 0.2,
  holdingMonths: 6,
  monthlyHolding: 800,
});
const lo = rescoreExisting(demo as any, parsed, {
  rehab: 5000,
  desiredProfitPct: 0.1,
});
console.log("rescore hi", hi[0].maxBid, "lo", lo[0].maxBid, "delta", hi[0].maxBid - lo[0].maxBid);
console.log("impact", impactStats(hi));
