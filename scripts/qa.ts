import assert from "node:assert/strict";
import { calculateMaxBid, normalizeBuyBox, propertiesToCsv, rescoreExisting, InputPropertySchema, type ScoredProperty } from "../lib/engine";
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

  const req = new Request("https://firstlook.local/test", { headers: { "x-forwarded-for": "203.0.113.9" } });
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, true, "first request should pass rate limit");
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, true, "second request should pass rate limit");
  assert.equal(checkRateLimit(req, "qa-rate", 2, 60000).ok, false, "third request should be throttled");

  console.log("FirstLook QA: all deterministic regression checks passed.");
}

run();
