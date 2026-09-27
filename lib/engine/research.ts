import { enrichWithAcs, geocodeProperty } from "./census";
import { cleanStreetAddress } from "./ingest";
import { buildResearchLinks } from "./links";
import { attachMaxBids } from "./maxBid";
import { attachDealTruthScores } from "./truthScore";
import {
  assignRanks,
  buildNotes,
  classifyPropertyType,
  collectRedFlags,
  estimateMarketRange,
  scoreProperty,
} from "./score";
import type { BuyBox, InputProperty, ScoredProperty } from "./types";

const RESEARCH_CONCURRENCY = 4;
const BATCH_PAUSE_MS = 180;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function researchOne(
  property: InputProperty,
  buyBox: BuyBox,
): Promise<Omit<ScoredProperty, "rank" | "lookAtFirst">> {
  const geo = await geocodeProperty(property);
  const acs = await enrichWithAcs(geo);

  const taxYearsList = property.tax_years
    .split(/[|,]/)
    .map((y) => y.trim())
    .filter(Boolean);
  const delinquencyYears = taxYearsList.length;
  const taxBurdenRatio = property.assessed_fmv > 0 ? property.cry_out_bid / property.assessed_fmv : 1;
  const equitySpread =
    property.assessed_fmv > 0
      ? (property.assessed_fmv - property.cry_out_bid) / property.assessed_fmv
      : 0;
  const propertyType = classifyPropertyType(property, buyBox);
  const market = estimateMarketRange(property.assessed_fmv, acs.tractMedianHomeValue);
  const redFlags = collectRedFlags(
    property,
    buyBox,
    propertyType,
    taxBurdenRatio,
    delinquencyYears,
    equitySpread,
  );
  const links = buildResearchLinks(property, geo.matchedAddress, geo.lat, geo.lon);

  const score = scoreProperty({
    property,
    buyBox,
    propertyType,
    taxBurdenRatio,
    delinquencyYears,
    equitySpread,
    tractMedianHomeValue: acs.tractMedianHomeValue,
  });

  const notes = buildNotes(
    property,
    propertyType,
    equitySpread,
    taxBurdenRatio,
    acs.tractMedianHomeValue,
    market.mid,
    redFlags,
  );

  return {
    ...property,
    matchedAddress: geo.matchedAddress,
    lat: geo.lat,
    lon: geo.lon,
    zip: geo.zip,
    city: geo.city,
    matchedState: geo.matchedState,
    tract: geo.tract,
    countyFips: geo.countyFips,
    stateFips: geo.stateFips,
    geocodeStatus: geo.geocodeStatus,
    tractMedianHomeValue: acs.tractMedianHomeValue,
    tractMedianIncome: acs.tractMedianIncome,
    tractName: acs.tractName,
    acsVintage: acs.acsVintage,
    ...links,
    cleanAddress: cleanStreetAddress(property.address),
    taxYearsList,
    delinquencyYears,
    taxBurdenRatio,
    equitySpread,
    estimatedMarketLow: market.low,
    estimatedMarketHigh: market.high,
    estimatedMarketMid: market.mid,
    propertyType,
    redFlags,
    notes,
    score,
  };
}

export async function researchProperties(
  properties: InputProperty[],
  buyBox: BuyBox,
  onProgress?: (done: number, total: number, parcelId: string) => void,
): Promise<ScoredProperty[]> {
  const researched: Omit<ScoredProperty, "rank" | "lookAtFirst">[] = [];
  let completed = 0;

  for (let start = 0; start < properties.length; start += RESEARCH_CONCURRENCY) {
    const batch = properties.slice(start, start + RESEARCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (property) => {
        const result = await researchOne(property, buyBox);
        completed += 1;
        onProgress?.(completed, properties.length, property.parcel_id);
        return result;
      }),
    );
    researched.push(...batchResults);

    if (start + RESEARCH_CONCURRENCY < properties.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  const withBids = attachMaxBids(researched);
  const ranked = assignRanks(withBids, buyBox);
  return attachDealTruthScores(ranked);
}
