import type { BuyBox, ScoredProperty } from "./types";
import {
  assignRanks,
  buildNotes,
  classifyPropertyType,
  collectRedFlags,
  estimateMarketRange,
  scoreProperty,
} from "./score";
import { attachMaxBids, type MaxBidDefaults } from "./maxBid";

/** Re-rank already-researched parcels with a new buy box (no re-geocode). */
export function rescoreExisting(
  properties: ScoredProperty[],
  buyBox: BuyBox,
  bidDefaults?: MaxBidDefaults,
): ScoredProperty[] {
  const rescored = properties.map((p) => {
    const propertyType = classifyPropertyType(p, buyBox);
    const taxBurdenRatio = p.assessed_fmv > 0 ? p.cry_out_bid / p.assessed_fmv : 1;
    const equitySpread =
      p.assessed_fmv > 0 ? (p.assessed_fmv - p.cry_out_bid) / p.assessed_fmv : 0;
    const delinquencyYears = p.delinquencyYears || p.taxYearsList?.length || 1;
    const market = estimateMarketRange(p.assessed_fmv, p.tractMedianHomeValue);
    const redFlags = collectRedFlags(p, buyBox, propertyType, taxBurdenRatio, delinquencyYears);
    const score = scoreProperty({
      property: p,
      buyBox,
      propertyType,
      taxBurdenRatio,
      delinquencyYears,
      equitySpread,
      tractMedianHomeValue: p.tractMedianHomeValue,
    });
    const notes = buildNotes(
      p,
      propertyType,
      equitySpread,
      taxBurdenRatio,
      p.tractMedianHomeValue,
      market.mid,
      redFlags,
    );

    return {
      ...p,
      propertyType,
      taxBurdenRatio,
      equitySpread,
      delinquencyYears,
      estimatedMarketLow: market.low,
      estimatedMarketHigh: market.high,
      estimatedMarketMid: market.mid,
      redFlags,
      notes,
      score,
    };
  });

  return attachMaxBids(assignRanks(rescored), bidDefaults);
}

export function impactStats(properties: ScoredProperty[]) {
  const total = properties.length;
  const lookFirst = properties.filter((p) => p.lookAtFirst).length;
  const flagged = properties.filter((p) => p.redFlags.length > 0).length;
  const skipped = Math.max(0, total - lookFirst);
  const hoursSaved = Math.round(total * 0.35 * 10) / 10; // ~20 min manual research each
  const problemSolvedPct = total > 0 ? Math.round((skipped / total) * 100) : 0;

  return {
    total,
    lookFirst,
    flagged,
    skipped,
    hoursSaved,
    problemSolvedPct,
    headline:
      total > 0
        ? `Cut ${total} parcels down to ${lookFirst} to chase first — ~${hoursSaved} hrs of blind research skipped`
        : "Upload a list to see how much noise FirstLook removes",
  };
}
