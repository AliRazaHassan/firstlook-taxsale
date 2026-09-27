import type { MaxBidInput, MaxBidResult } from "./types";

export type MaxBidDefaults = {
  rehab?: number;
  holdingMonths?: number;
  monthlyHolding?: number;
  closingBuyPct?: number;
  closingSellPct?: number;
  desiredProfitPct?: number;
  contingencyPct?: number;
  titleLegal?: number;
  survivingLiens?: number;
  evictionPossession?: number;
  auctionFees?: number;
  redemptionCarry?: number;
};

function safeMoney(value: number | undefined, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, fallback);
}

function safePct(value: number | undefined, fallback: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** Investor MAO: ARV minus all costs and target profit, solving buy-side closing costs against the offer itself. */
export function calculateMaxBid(input: MaxBidInput): MaxBidResult {
  const arv = safeMoney(input.arv);
  const rehab = safeMoney(input.rehab);
  const holdingMonths = safeMoney(input.holdingMonths, 4);
  const monthlyHolding = safeMoney(input.monthlyHolding, 500);
  const closingBuyPct = safePct(input.closingBuyPct, 0.02);
  const closingSellPct = safePct(input.closingSellPct, 0.06);
  const desiredProfit = safeMoney(input.desiredProfit, Math.round(arv * 0.15));
  const contingency = safeMoney(input.contingency, Math.round(rehab * 0.1));
  const titleLegal = safeMoney(input.titleLegal);
  const survivingLiens = safeMoney(input.survivingLiens);
  const evictionPossession = safeMoney(input.evictionPossession);
  const auctionFees = safeMoney(input.auctionFees);
  const redemptionCarry = safeMoney(input.redemptionCarry);
  const riskCosts = titleLegal + survivingLiens + evictionPossession + auctionFees + redemptionCarry;

  const holding = holdingMonths * monthlyHolding;
  const closingSell = arv * closingSellPct;
  const beforeBuyClosing =
    arv - rehab - holding - closingSell - desiredProfit - contingency - riskCosts;

  // If buy-side closing costs are X% of the offer, offer + offer*X = available amount.
  const solvedOffer = beforeBuyClosing / (1 + closingBuyPct);
  const maxBid = Math.max(0, Math.round(solvedOffer));
  const closingBuy = Math.round(maxBid * closingBuyPct);
  const roundedClosingSell = Math.round(closingSell);
  const totalCosts =
    rehab + holding + closingBuy + roundedClosingSell + contingency + riskCosts;
  const projectedProfit = Math.round(arv - maxBid - totalCosts);
  const equityVsCryOut =
    input.cryOutBid != null ? Math.round(maxBid - Math.max(0, input.cryOutBid)) : null;

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
      closingSell: roundedClosingSell,
      desiredProfit,
      contingency,
      titleLegal,
      survivingLiens,
      evictionPossession,
      auctionFees,
      redemptionCarry,
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
  const desiredProfitPct = safePct(defaults.desiredProfitPct, 0.15);

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
      contingency: Math.round(rehab * safePct(defaults.contingencyPct, 0.1)),
      cryOutBid: row.cry_out_bid,
      titleLegal: defaults.titleLegal,
      survivingLiens: defaults.survivingLiens,
      evictionPossession: defaults.evictionPossession,
      auctionFees: defaults.auctionFees,
      redemptionCarry: defaults.redemptionCarry,
    });
    return {
      ...row,
      maxBid: result.maxBid,
      projectedProfitAtMaxBid: result.projectedProfit,
    };
  });
}
