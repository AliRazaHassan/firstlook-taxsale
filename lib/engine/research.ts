import { enrichWithAcs, geocodeProperty } from "./census";
import { cleanStreetAddress } from "./ingest";
import { buildResearchLinks } from "./links";
import { attachMaxBids } from "./maxBid";
import {
  assignRanks,
  buildNotes,
  classifyPropertyType,
  collectRedFlags,
  estimateMarketRange,
  scoreProperty,
} from "./score";
import type { BuyBox, InputProperty, ScoredProperty } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function researchProperties(
  properties: InputProperty[],
  buyBox: BuyBox,
  onProgress?: (done: number, total: number, parcelId: string) => void,
): Promise<ScoredProperty[]> {
  const researched: Omit<ScoredProperty, "rank" | "lookAtFirst">[] = [];

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    onProgress?.(i + 1, properties.length, property.parcel_id);

    const geo = await geocodeProperty(property);
    await sleep(180);
    const acs = await enrichWithAcs(geo);
    await sleep(120);

    const taxYearsList = property.tax_years
      .split(/[|,]/)
      .map((y) => y.trim())
      .filter(Boolean);
    const delinquencyYears = taxYearsList.length || 1;
    const taxBurdenRatio = property.assessed_fmv > 0 ? property.cry_out_bid / property.assessed_fmv : 1;
    const equitySpread =
      property.assessed_fmv > 0
        ? (property.assessed_fmv - property.cry_out_bid) / property.assessed_fmv
        : 0;
    const propertyType = classifyPropertyType(property, buyBox);
    const market = estimateMarketRange(property.assessed_fmv, acs.tractMedianHomeValue);
    const redFlags = collectRedFlags(property, buyBox, propertyType, taxBurdenRatio, delinquencyYears);
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

    researched.push({
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
    });
  }

  const ranked = assignRanks(researched);
  return attachMaxBids(ranked);
}
