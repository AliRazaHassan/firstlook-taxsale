import { enrichWithAcs, geocodeProperty } from "./census.js";
import type { BuyBox, InputProperty, ScoredProperty } from "./types.js";
import { buildHumanRedfinUrl, buildResearchLinks } from "./links.js";
import { cleanStreetAddress } from "./ingest.js";
import {
  assignRanks,
  buildNotes,
  classifyPropertyType,
  collectRedFlags,
  estimateMarketRange,
  scoreProperty,
} from "./score.js";

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
    // Be polite to public Census endpoints
    await sleep(200);
    const acs = await enrichWithAcs(geo);
    await sleep(150);

    const taxYearsList = property.tax_years.split("|").map((y) => y.trim()).filter(Boolean);
    const delinquencyYears = taxYearsList.length;
    const taxBurdenRatio = property.assessed_fmv > 0 ? property.cry_out_bid / property.assessed_fmv : 1;
    const equitySpread = property.assessed_fmv > 0 ? (property.assessed_fmv - property.cry_out_bid) / property.assessed_fmv : 0;
    const propertyType = classifyPropertyType(property, buyBox);
    const market = estimateMarketRange(property.assessed_fmv, acs.tractMedianHomeValue);
    const redFlags = collectRedFlags(property, buyBox, propertyType, taxBurdenRatio, delinquencyYears);
    const links = buildResearchLinks(property, geo.matchedAddress, geo.lat, geo.lon);
    links.redfinUrl = buildHumanRedfinUrl(
      geo.matchedAddress ?? `${cleanStreetAddress(property.address)}, ${property.city_hint || "Jonesboro"}, ${property.state}`,
    );

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
      ...geo,
      ...acs,
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

  return assignRanks(researched);
}
