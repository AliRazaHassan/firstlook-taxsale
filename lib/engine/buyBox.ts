import { BuyBoxSchema, type BuyBox } from "./types";

export const DEFAULT_BUY_BOX = {
  name: "Investor default buy box",
  description: "Prefer residential with wide FMV vs bid spread; flag vacant land and heavy tax burden.",
  preferResidential: true,
  avoidVacantLand: true,
  avoidLlcInvestorOwned: false,
  maxTaxBurdenRatio: 0.12,
  minAssessedValue: 80000,
  targetEquitySpreadMin: 0.7,
  minEquitySpread: 0.45,
  maxCryOutBid: 0,
  minLookFirstScore: 55,
  minBidHeadroomPct: 0.15,
  maxLookFirst: 5,
  weights: {
    equitySpread: 35,
    taxBurden: 20,
    delinquencyYears: 15,
    propertyType: 15,
    neighborhoodValue: 15,
  },
  redFlags: {
    vacantLandKeywords: ["N LAKE", "LOT", "VACANT", "UNIMPROVED"],
    lowAssessedValue: 50000,
    highTaxBurdenRatio: 0.15,
    longDelinquencyYears: 4,
  },
} as const;

/** Deep-merge any partial/localStorage buy box into a schema-valid object. */
export function normalizeBuyBox(raw: unknown): BuyBox {
  const base: BuyBox = {
    ...DEFAULT_BUY_BOX,
    weights: { ...DEFAULT_BUY_BOX.weights },
    redFlags: {
      ...DEFAULT_BUY_BOX.redFlags,
      vacantLandKeywords: [...DEFAULT_BUY_BOX.redFlags.vacantLandKeywords],
    },
  };

  if (!raw || typeof raw !== "object") return BuyBoxSchema.parse(base);

  const o = raw as Record<string, unknown>;
  const weightsIn =
    o.weights && typeof o.weights === "object" ? (o.weights as Record<string, number>) : {};
  const flagsIn =
    o.redFlags && typeof o.redFlags === "object"
      ? (o.redFlags as Record<string, unknown>)
      : {};

  const merged = {
    ...base,
    ...o,
    maxTaxBurdenRatio: Math.max(0.001, Math.min(1, Number(o.maxTaxBurdenRatio ?? base.maxTaxBurdenRatio) || base.maxTaxBurdenRatio)),
    minAssessedValue: Math.max(0, Math.min(100_000_000, Number(o.minAssessedValue ?? base.minAssessedValue) || 0)),
    targetEquitySpreadMin: Math.max(0.01, Math.min(1, Number(o.targetEquitySpreadMin ?? base.targetEquitySpreadMin) || base.targetEquitySpreadMin)),
    minEquitySpread: Math.max(-1, Math.min(1, Number(o.minEquitySpread ?? base.minEquitySpread))),
    maxCryOutBid: Math.max(0, Math.min(100_000_000, Number(o.maxCryOutBid ?? base.maxCryOutBid) || 0)),
    minLookFirstScore: Math.max(0, Math.min(100, Number(o.minLookFirstScore ?? base.minLookFirstScore) || 0)),
    minBidHeadroomPct: Math.max(0, Math.min(0.95, Number(o.minBidHeadroomPct ?? base.minBidHeadroomPct) || 0)),
    maxLookFirst: Math.max(1, Math.min(25, Math.round(Number(o.maxLookFirst ?? base.maxLookFirst) || base.maxLookFirst))),
    weights: Object.fromEntries(Object.entries(base.weights).map(([key, fallback]) => {
      const value = Number(weightsIn[key]);
      return [key, Math.max(0, Math.min(100, Number.isFinite(value) ? value : fallback))];
    })) as BuyBox["weights"],
    redFlags: {
      ...base.redFlags,
      ...flagsIn,
      lowAssessedValue: Math.max(0, Math.min(100_000_000, Number(flagsIn.lowAssessedValue ?? base.redFlags.lowAssessedValue) || 0)),
      highTaxBurdenRatio: Math.max(0, Math.min(1, Number(flagsIn.highTaxBurdenRatio ?? base.redFlags.highTaxBurdenRatio) || 0)),
      longDelinquencyYears: Math.max(1, Math.min(50, Math.round(Number(flagsIn.longDelinquencyYears ?? base.redFlags.longDelinquencyYears) || 1))),
      vacantLandKeywords: Array.isArray(flagsIn.vacantLandKeywords)
        ? (flagsIn.vacantLandKeywords as string[])
        : base.redFlags.vacantLandKeywords,
    },
  };

  return BuyBoxSchema.parse(merged);
}
