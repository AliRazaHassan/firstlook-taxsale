import assert from "node:assert/strict";
import { calculateDealAnalysis, calculateMaxBid, normalizeBuyBox, propertiesToCsv, rescoreExisting, InputPropertySchema, type DealAnalysisInput, type ScoredProperty } from "../lib/engine";
import { checkRateLimit } from "../lib/rateLimit";

function synthetic(overrides: Partial<ScoredProperty>): ScoredProperty {
  return {
    sale_date: "2026-10-01",
    parcel_id: "QA-1",
    owner: "TEST OWNER",
    address: "100 MAIN ST",
    tax_years: "2024|2025",
    assessed_fmv: 200000,
    cry_out_bid: 20000,
    property_type_hint: "residential",
    county: "Clayton",
    state: "GA",
    city_hint: "",
    matchedAddress: "100 MAIN ST",
    lat: 33.5,
    lon: -84.3,
    zip: "30236",
    city: "Jonesboro",
    matchedState: "GA",
    tract: "1",
    countyFips: "063",
    stateFips: "13",
    geocodeStatus: "matched",
    tractMedianHomeValue: 220000,
    tractMedianIncome: 70000,
    tractName: "QA tract",
    acsVintage: "2024",
    assessorUrl: "",
    zillowUrl: "",
    redfinUrl: "",
    regridUrl: "",
    googleMapsUrl: "",
    cleanAddress: "100 MAIN ST",
    taxYearsList: ["2024","2025"],
    delinquencyYears: 2,
    taxBurdenRatio: 0.1,
    equitySpread: 0.9,
    estimatedMarketLow: 180000,
    estimatedMarketHigh: 220000,
    estimatedMarketMid: 200000,
    propertyType: "residential",
    redFlags: [],
    notes: "",
    score: 80,
    rank: 1,
    lookAtFirst: true,
    ...overrides,
  };
}

function run() {
  const normalized = normalizeBuyBox({
    maxTaxBurdenRatio: 0,
    maxLookFirst: 999,
    minLookFirstScore: -5,
    minEquitySpread: 2,
  });
  assert(normalized.maxTaxBurdenRatio > 0, "maxTaxBurdenRatio must never normalize to zero");
  assert.equal(normalized.maxLookFirst, 25, "maxLookFirst should clamp to 25");
  assert.equal(normalized.minLookFirstScore, 0, "minLookFirstScore should clamp to 0");
  assert.equal(normalized.minEquitySpread, 1, "minEquitySpread should clamp to 1");
  const headroomClamp = normalizeBuyBox({ minBidHeadroomPct: 2 });
  assert.equal(headroomClamp.minBidHeadroomPct, 0.95, "bid headroom should clamp to 95%");
  const extremeBox = normalizeBuyBox({ minAssessedValue: 1e12, maxCryOutBid: 999_999_999, redFlags: { lowAssessedValue: 1e12, highTaxBurdenRatio: 5, longDelinquencyYears: 100 }, weights: { equitySpread: 1000, taxBurden: -10 } });
  assert.equal(extremeBox.minAssessedValue, 100_000_000);
  assert.equal(extremeBox.maxCryOutBid, 100_000_000);
  assert.equal(extremeBox.redFlags.lowAssessedValue, 100_000_000);
  assert.equal(extremeBox.weights.equitySpread, 100);
  assert.equal(extremeBox.weights.taxBurden, 0);

  const invalidJurisdiction = InputPropertySchema.safeParse({
    parcel_id: "NO-JURISDICTION",
    address: "1 TEST ST",
    assessed_fmv: 100000,
    cry_out_bid: 10000,
  });
  assert.equal(invalidJurisdiction.success, false, "county/state must be required; never silently default jurisdiction");

  const zeroWeightBox = normalizeBuyBox({ weights: { equitySpread: 0, taxBurden: 0, delinquencyYears: 0, propertyType: 0, neighborhoodValue: 0 } });
  const zeroWeightResult = rescoreExisting([synthetic({ parcel_id: "ZERO-WEIGHTS" })], zeroWeightBox);
  assert.equal(zeroWeightResult[0]?.score, 0, "all-zero custom weights must produce a finite zero score, never NaN");

  const bid = calculateMaxBid({
    arv: 200000,
    rehab: 30000,
    holdingMonths: 6,
    monthlyHolding: 500,
    closingBuyPct: 0.02,
    closingSellPct: 0.08,
    desiredProfit: 30000,
    contingency: 3000,
  });
  assert.equal(bid.maxBid, 115686, "max bid should solve buy-side closing costs against the offer");
  assert(Math.abs(bid.projectedProfit - 30000) <= 2, "projected profit should stay at the target after rounding");

  const baseRiskBid = calculateMaxBid({
    arv: 200000,
    rehab: 25000,
    holdingMonths: 4,
    monthlyHolding: 500,
    desiredProfit: 30000,
    contingency: 2500,
  });
  const reservedRiskBid = calculateMaxBid({
    arv: 200000,
    rehab: 25000,
    holdingMonths: 4,
    monthlyHolding: 500,
    desiredProfit: 30000,
    contingency: 5000,
    titleLegal: 5000,
    survivingLiens: 10000,
    auctionFees: 1500,
  });
  assert(reservedRiskBid.maxBid < baseRiskBid.maxBid, "additional risk reserves and contingency must lower the max bid");
  assert(reservedRiskBid.totalCosts > baseRiskBid.totalCosts, "risk reserves must increase modeled total costs");

  const safe = calculateMaxBid({
    arv: -1,
    rehab: -10,
    holdingMonths: -5,
    monthlyHolding: -1,
    closingBuyPct: 5,
    closingSellPct: -1,
  });
  assert.equal(safe.maxBid, 0, "negative/unsafe inputs must not create a positive max bid");
  assert(safe.totalCosts >= 0, "costs must remain non-negative");

  const box = normalizeBuyBox({
    maxCryOutBid: 50000,
    minEquitySpread: 0.5,
    minLookFirstScore: 0,
    maxLookFirst: 1,
  });
  const rescored = rescoreExisting([
    synthetic({ parcel_id: "TOO-HIGH", cry_out_bid: 90000 }),
    synthetic({ parcel_id: "GOOD", cry_out_bid: 20000 }),
  ], box);
  assert.equal(rescored.filter((p) => p.lookAtFirst).length, 1, "Look First count must obey maxLookFirst");
  assert.equal(rescored.find((p) => p.parcel_id === "TOO-HIGH")?.lookAtFirst, false, "cry-out above cap must not be Look First");
  assert.equal(rescored.find((p) => p.parcel_id === "GOOD")?.lookAtFirst, true, "qualified property should be Look First");

  const strictBox = normalizeBuyBox({ maxLookFirst: 5, minLookFirstScore: 0, avoidLlcInvestorOwned: true });
  const strictRows = rescoreExisting([
    synthetic({ parcel_id: "ENTITY", owner: "TEST INVESTMENTS LLC", cry_out_bid: 10000 }),
    synthetic({ parcel_id: "RELATED", property_type_hint: "related", cry_out_bid: 10000 }),
  ], strictBox);
  assert.equal(strictRows.some((p) => p.lookAtFirst), false, "Look First must not fill quotas with explicitly excluded risky deal types");

  const permissiveBox = normalizeBuyBox({
    minLookFirstScore: 0,
    minEquitySpread: -1,
    minBidHeadroomPct: 0,
    minAssessedValue: 0,
    avoidVacantLand: false,
    avoidLlcInvestorOwned: false,
    maxLookFirst: 5,
  });
  const permissiveRows = rescoreExisting([
    synthetic({ parcel_id: "VACANT-ALLOWED", property_type_hint: "vacant", cry_out_bid: 10000 }),
    synthetic({ parcel_id: "ENTITY-ALLOWED", owner: "TEST INVESTMENTS LLC", cry_out_bid: 10000 }),
  ], permissiveBox, { rehab: 10000, desiredProfitPct: 0.1 });
  assert.equal(permissiveRows.find((p) => p.parcel_id === "VACANT-ALLOWED")?.lookAtFirst, true, "vacant deals may qualify when avoidVacantLand is off");
  assert.equal(permissiveRows.find((p) => p.parcel_id === "ENTITY-ALLOWED")?.lookAtFirst, true, "entity-owned deals may qualify when the avoidance toggle is off");

  const valueFloorBox = normalizeBuyBox({
    minLookFirstScore: 0,
    minEquitySpread: -1,
    minBidHeadroomPct: 0,
    minAssessedValue: 150000,
  });
  const belowFloor = rescoreExisting([
    synthetic({ parcel_id: "BELOW-FLOOR", assessed_fmv: 100000, cry_out_bid: 10000, tractMedianHomeValue: 150000 }),
  ], valueFloorBox, { rehab: 10000, desiredProfitPct: 0.1 });
  assert.equal(belowFloor[0]?.lookAtFirst, false, "min assessed value must be a real Look First hard floor");

  const ratioCapBox = normalizeBuyBox({
    minLookFirstScore: 0,
    minEquitySpread: -1,
    minBidHeadroomPct: 0,
    minAssessedValue: 0,
    maxTaxBurdenRatio: 0.1,
  });
  const aboveRatioCap = rescoreExisting([
    synthetic({ parcel_id: "ABOVE-RATIO-CAP", assessed_fmv: 200000, cry_out_bid: 30000 }),
  ], ratioCapBox, { rehab: 10000, desiredProfitPct: 0.1 });
  assert.equal(aboveRatioCap[0]?.lookAtFirst, false, "max cry-out/FMV ratio must be a real Look First ceiling");

  const evidenceBox = normalizeBuyBox({ minLookFirstScore: 0, minEquitySpread: -1 });
  const missingHistory = rescoreExisting([synthetic({ parcel_id: "MISSING-HISTORY", tax_years: "", taxYearsList: [], delinquencyYears: 0 })], evidenceBox);
  assert(missingHistory[0]?.redFlags.some((f) => /history missing/i.test(f)), "missing delinquency history must be explicit, not silently rewarded");

  const overbidBox = normalizeBuyBox({ minLookFirstScore: 0, minEquitySpread: -1, maxCryOutBid: 0, maxLookFirst: 5, minBidHeadroomPct: 0.15 });
  const nearCeilingRows = rescoreExisting([
    synthetic({ parcel_id: "NEAR-CEILING", assessed_fmv: 100000, tractMedianHomeValue: 220000, cry_out_bid: 90000 }),
  ], overbidBox, { rehab: 25000, desiredProfitPct: 0.15 });
  assert.equal(nearCeilingRows[0]?.lookAtFirst, false, "a deal without the required bid headroom must never be Look First");
  assert((nearCeilingRows[0]?.maxBid ?? 0) > 90000, "fixture should prove this case is below max bid but still too close to the ceiling");

  const overMaxRows = rescoreExisting([
    synthetic({ parcel_id: "OVER-MAX", assessed_fmv: 100000, tractMedianHomeValue: null, cry_out_bid: 90000 }),
  ], normalizeBuyBox({ minLookFirstScore: 0, minEquitySpread: -1, minBidHeadroomPct: 0 }), { rehab: 25000, desiredProfitPct: 0.15 });
  assert.equal(overMaxRows[0]?.lookAtFirst, false, "a deal at or above modeled max bid must never be Look First");
  assert((overMaxRows[0]?.maxBid ?? 0) <= 90000, "fixture should actually be at or above its modeled ceiling");

  const formulaCsv = propertiesToCsv([
    synthetic({
      parcel_id: "=HYPERLINK(\"https://example.invalid\",\"x\")",
      owner: "+CMD",
      address: "@SUM(1,1)",
      cleanAddress: "@SUM(1,1)",
    }),
  ]);
  assert(formulaCsv.includes("'=HYPERLINK"), "CSV export must neutralize formula-like parcel values");
  assert(formulaCsv.includes("'+CMD"), "CSV export must neutralize formula-like owner values");
  assert(formulaCsv.includes("'@SUM"), "CSV export must neutralize formula-like address values");

  const baseDeal: DealAnalysisInput = {
    purchasePrice: 80000, arv: 180000, rehab: 30000, monthlyRent: 1800,
    downPaymentPct: 20, interestRate: 7.5, loanYears: 30, vacancyPct: 5, managementPct: 8,
    taxesMonthly: 250, insuranceMonthly: 125, otherMonthly: 75, buyClosingPct: 2, sellClosingPct: 8,
    holdingMonths: 6, monthlyHolding: 650, contingencyPct: 10, targetProfitPct: 15,
    refiLtvPct: 75, refiClosingPct: 3, titleLegal: 3000, survivingLiens: 0,
    evictionPossession: 1500, auctionFees: 800, redemptionCarry: 0,
  };
  const baseFlip = calculateDealAnalysis(baseDeal, "flip");
  const baseRental = calculateDealAnalysis(baseDeal, "rental");
  const baseBrrrr = calculateDealAnalysis(baseDeal, "brrrr");
  const refiPrincipal = baseDeal.arv * baseDeal.refiLtvPct / 100;
  const monthlyRate = baseDeal.interestRate / 1200;
  const monthlyPayments = baseDeal.loanYears * 12;
  const expectedRefiPayment = refiPrincipal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -monthlyPayments));
  assert(Math.abs(baseBrrrr.mortgage - expectedRefiPayment) < 0.01, "BRRRR operating mortgage must amortize the refinance principal");
  assert(Math.abs(baseBrrrr.cashFlow - (baseDeal.monthlyRent - baseDeal.monthlyRent * .13 - baseDeal.taxesMonthly - baseDeal.insuranceMonthly - baseDeal.otherMonthly - expectedRefiPayment)) < 0.01, "BRRRR cash flow must use refinance debt service");
  assert(baseBrrrr.cashFlow < baseRental.cashFlow, "larger refinance loan must reduce stabilized cash flow");
  assert.equal(baseBrrrr.annualDebtService, baseBrrrr.mortgage * 12);
  const riskierFlip = calculateDealAnalysis({ ...baseDeal, titleLegal: 10000, survivingLiens: 15000 }, "flip");
  assert(riskierFlip.flipProfit < baseFlip.flipProfit, "more risk reserves must lower flip profit");
  assert(riskierFlip.mao < baseFlip.mao, "more risk reserves must lower MAO");
  assert(baseFlip.stress.flipProfit <= baseFlip.flipProfit, "flip downside stress must not be more optimistic than base case");

  for (let i = 1; i <= 200; i++) {
    const seededDeal: DealAnalysisInput = {
      ...baseDeal,
      purchasePrice: 5000 + (i * 7919) % 250000,
      arv: 60000 + (i * 11939) % 450000,
      rehab: (i * 3571) % 120000,
      monthlyRent: 700 + (i * 47) % 3500,
      downPaymentPct: (i * 7) % 101,
      interestRate: (i * 13) % 20,
      loanYears: 5 + (i % 41),
      vacancyPct: (i * 3) % 25,
      managementPct: (i * 5) % 20,
      taxesMonthly: (i * 71) % 1200,
      insuranceMonthly: (i * 29) % 600,
      otherMonthly: (i * 17) % 500,
      buyClosingPct: (i * 2) % 10,
      sellClosingPct: 4 + (i % 12),
      holdingMonths: i % 25,
      monthlyHolding: (i * 83) % 2500,
      contingencyPct: (i * 4) % 35,
      targetProfitPct: 5 + (i % 31),
      refiLtvPct: 50 + (i % 46),
      refiClosingPct: (i * 2) % 8,
      titleLegal: (i * 101) % 15000,
      survivingLiens: (i * 131) % 25000,
      evictionPossession: (i * 53) % 10000,
      auctionFees: (i * 19) % 5000,
      redemptionCarry: (i * 97) % 12000,
    };
    for (const strategy of ["flip","rental","brrrr"] as const) {
      const out = calculateDealAnalysis(seededDeal, strategy);
      const numericValues = [
        out.down,out.loan,out.mortgage,out.monthlyExpenses,out.cashFlow,out.annualNoi,out.dscr,
        out.loanToValue,out.cashNeeded,out.capRate,out.cashOnCash,out.flipProfit,out.mao,out.refiNet,
        out.remainingLoan,out.cashBackFromRefi,out.cashLeftIn,out.stress.flipProfit,out.stress.cashFlow,out.stress.dscr,
      ];
      assert(numericValues.every(Number.isFinite), `scenario ${i} ${strategy} must never emit NaN/Infinity`);
      assert(out.loan >= 0 && out.remainingLoan >= 0 && out.refiNet >= 0 && out.cashLeftIn >= 0, `scenario ${i} ${strategy} debt/cash floor invariant`);
      if (strategy === "flip") assert(out.stress.flipProfit <= out.flipProfit + 0.01, `scenario ${i} stress flip should not improve profit`);
      if (strategy !== "flip") assert(out.stress.cashFlow <= out.cashFlow + 0.01, `scenario ${i} rental stress should not improve cash flow`);
      if (strategy === "brrrr") assert(out.cashBackFromRefi <= out.refiNet + 0.01, `scenario ${i} BRRRR cash back cannot exceed net refi proceeds`);
    }
  }

  const req = new Request("https://firstlook.local/test", { headers: { "x-forwarded-for": "203.0.113.9" } });
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, true, "first request should pass rate limit");
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, true, "second request should pass rate limit");
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, false, "third request should be throttled");

  console.log("FirstLook QA: all deterministic regression checks passed.");
}

run();
