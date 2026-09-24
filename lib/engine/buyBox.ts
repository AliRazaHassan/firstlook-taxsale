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
