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
    weights: { ...base.weights, ...weightsIn },
    redFlags: {
      ...base.redFlags,
      ...flagsIn,
      vacantLandKeywords: Array.isArray(flagsIn.vacantLandKeywords)
        ? (flagsIn.vacantLandKeywords as string[])
        : base.redFlags.vacantLandKeywords,
    },
  };

  return BuyBoxSchema.parse(merged);
}
