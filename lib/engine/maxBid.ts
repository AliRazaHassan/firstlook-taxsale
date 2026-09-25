import type { MaxBidInput, MaxBidResult } from "./types";

export type MaxBidDefaults = {
  rehab?: number;
  holdingMonths?: number;
  monthlyHolding?: number;
  closingBuyPct?: number;
  closingSellPct?: number;
  desiredProfitPct?: number;
};

/** Classic investor MAO: ARV minus all costs and desired profit. */
export function calculateMaxBid(input: MaxBidInput): MaxBidResult {
  const arv = Math.max(0, input.arv);
  const rehab = Math.max(0, input.rehab);
  const holdingMonths = input.holdingMonths ?? 4;
  const monthlyHolding = input.monthlyHolding ?? 500;
  const closingBuyPct = input.closingBuyPct ?? 0.02;
  const closingSellPct = input.closingSellPct ?? 0.06;
  const desiredProfit = input.desiredProfit ?? Math.round(arv * 0.15);
  const contingency = input.contingency ?? Math.round(rehab * 0.1);

  const holding = holdingMonths * monthlyHolding;
  let provisional = arv * 0.7;
  for (let i = 0; i < 3; i++) {
    const closingBuy = provisional * closingBuyPct;
    const closingSell = arv * closingSellPct;
    provisional = arv - rehab - holding - closingBuy - closingSell - desiredProfit - contingency;
  }

  const maxBid = Math.max(0, Math.round(provisional));
  const closingBuy = Math.round(maxBid * closingBuyPct);
  const closingSell = Math.round(arv * closingSellPct);
  const totalCosts = rehab + holding + closingBuy + closingSell + contingency;
  const projectedProfit = Math.round(arv - maxBid - totalCosts);
  const equityVsCryOut =
    input.cryOutBid != null ? Math.round(maxBid - input.cryOutBid) : null;

  return {
    maxBid,
    totalCosts,
    projectedProfit,
    equityVsCryOut,
    breakdown: {
      arv,
      rehab,
      holding,
      closingBuy,
      closingSell,
      desiredProfit,
      contingency,
    },
  };
}

export function attachMaxBids<
  T extends {
    estimatedMarketMid: number | null;
    assessed_fmv: number;
    cry_out_bid: number;
  },
>(
  rows: T[],
  defaults: MaxBidDefaults = {},
): (T & { maxBid: number; projectedProfitAtMaxBid: number })[] {
  const rehab = defaults.rehab ?? 25000;
  const desiredProfitPct = defaults.desiredProfitPct ?? 0.15;

  return rows.map((row) => {
    const arv = row.estimatedMarketMid ?? row.assessed_fmv;
    const result = calculateMaxBid({
      arv,
      rehab,
      holdingMonths: defaults.holdingMonths,
      monthlyHolding: defaults.monthlyHolding,
      closingBuyPct: defaults.closingBuyPct,
      closingSellPct: defaults.closingSellPct,
      desiredProfit: Math.round(arv * desiredProfitPct),
      cryOutBid: row.cry_out_bid,
    });
    return {
      ...row,
      maxBid: result.maxBid,
      projectedProfitAtMaxBid: result.projectedProfit,
    };
  });
}
