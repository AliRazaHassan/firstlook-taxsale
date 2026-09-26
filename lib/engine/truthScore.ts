import type { ScoredProperty } from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type DealTruthScore = {
  overall: number;
  opportunity: number;
  valuation: number;
  titleLegal: number;
  auctionSafety: number;
  liquidity: number;
  confidence: "low" | "medium";
  reasons: string[];
};

/**
 * Decision-support score built only from evidence FirstLook actually has.
 * Unknown title/legal facts are penalized instead of silently treated as clean.
 */
export function calculateDealTruthScore(property: ScoredProperty): DealTruthScore {
  const reasons: string[] = [];
  const maxBid = property.maxBid ?? 0;
  const headroom = maxBid > 0 ? (maxBid - property.cry_out_bid) / maxBid : -1;

  const opportunity = clamp(
    45 + property.equitySpread * 55 + (headroom > 0 ? Math.min(25, headroom * 35) : -30),
  );

  let valuation = property.geocodeStatus === "matched" ? 55 : 30;
  if (property.tractMedianHomeValue != null) valuation += 15;
  if (property.assessed_fmv > 0) valuation += 10;
  valuation = clamp(valuation);
  if (valuation < 70) reasons.push("Valuation needs property-level comparable sales.");

  let titleLegal = 55;
  if (property.redFlags.some((f) => /entity|related parcel/i.test(f))) titleLegal -= 12;
  if (property.redFlags.some((f) => /incomplete street/i.test(f))) titleLegal -= 10;
  titleLegal = clamp(titleLegal);
  reasons.push("Title, surviving liens, redemption and occupancy still require verification.");

  let auctionSafety = 50;
  if (maxBid > 0 && property.cry_out_bid < maxBid) auctionSafety += Math.min(40, Math.max(0, headroom * 60));
  if (maxBid <= 0 || property.cry_out_bid >= maxBid) auctionSafety -= 40;
  auctionSafety = clamp(auctionSafety);
  if (auctionSafety < 60) reasons.push("Cry-out is too close to or above the modeled hard max.");

  let liquidity = 50;
  if (property.propertyType === "residential") liquidity += 25;
  if (property.propertyType.includes("vacant")) liquidity -= 20;
  if (property.propertyType === "related_parcel") liquidity -= 20;
  if (property.tractMedianIncome != null) liquidity += 5;
  liquidity = clamp(liquidity);

  const overall = clamp(
    opportunity * 0.3 + valuation * 0.2 + titleLegal * 0.2 + auctionSafety * 0.2 + liquidity * 0.1,
  );
  const confidence: "low" | "medium" =
    property.geocodeStatus === "matched" && property.tractMedianHomeValue != null ? "medium" : "low";

  return { overall, opportunity, valuation, titleLegal, auctionSafety, liquidity, confidence, reasons };
}

export function attachDealTruthScores<T extends ScoredProperty>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row, dealTruth: calculateDealTruthScore(row) }));
}
