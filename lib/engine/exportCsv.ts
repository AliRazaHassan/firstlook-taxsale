import { stringify } from "csv-stringify/sync";
import type { ScoredProperty } from "./types";
import { resolveCountyRules } from "./countyRules";
import { overbidRisk, valuationConfidence } from "./diligence";

/** Auction-day bid sheet — only look-first / selected rows. */
export function propertiesToBidSheet(properties: ScoredProperty[]): string {
  const rows = properties
    .filter((p) => p.lookAtFirst || p.score >= 70)
    .map((p) => {
      const rules = resolveCountyRules(p.state, p.county);
      const risk = overbidRisk(p);
      const conf = valuationConfidence(p);
      return {
        rank: p.rank,
        walk_away_max_bid: p.maxBid ?? "",
        cry_out_bid: p.cry_out_bid,
        address: p.cleanAddress,
        parcel_apn: p.parcel_id,
        owner: p.owner,
        score: p.score,
        overbid_risk: risk.level,
        overbid_note: risk.message,
        valuation_confidence: conf.level,
        sale_type: rules.saleType,
        county_rules: rules.label,
        red_flags: p.redFlags.join(" | "),
        maps: p.googleMapsUrl,
        assessor: p.assessorUrl,
      };
    });

  return stringify(rows, {
    header: true,
    columns: [
      "rank",
      "walk_away_max_bid",
      "cry_out_bid",
      "address",
      "parcel_apn",
      "owner",
      "score",
      "overbid_risk",
      "overbid_note",
      "valuation_confidence",
      "sale_type",
      "county_rules",
      "red_flags",
      "maps",
      "assessor",
    ],
  });
}

export function propertiesToCsv(properties: ScoredProperty[]): string {
  const COLUMNS = [
    "rank",
    "look_at_first",
    "score",
    "address",
    "matched_address",
    "parcel_apn",
    "owner",
    "property_type",
    "assessed_fmv",
    "cry_out_bid",
    "max_bid",
    "projected_profit",
    "equity_spread_pct",
    "estimated_market_mid",
    "tract_median_home_value",
    "assessor_url",
    "zillow_url",
    "redfin_url",
    "regrid_url",
    "google_maps_url",
    "red_flags",
    "notes",
  ] as const;

  const rows = properties.map((p) => ({
    rank: p.rank,
    look_at_first: p.lookAtFirst ? "YES" : "",
    score: p.score,
    address: p.cleanAddress,
    matched_address: p.matchedAddress ?? "",
    parcel_apn: p.parcel_id,
    owner: p.owner,
    property_type: p.propertyType,
    assessed_fmv: p.assessed_fmv,
    cry_out_bid: p.cry_out_bid,
    max_bid: p.maxBid ?? "",
    projected_profit: p.projectedProfitAtMaxBid ?? "",
    equity_spread_pct: Math.round(p.equitySpread * 1000) / 10,
    estimated_market_mid: p.estimatedMarketMid ?? "",
    tract_median_home_value: p.tractMedianHomeValue ?? "",
    assessor_url: p.assessorUrl,
    zillow_url: p.zillowUrl,
    redfin_url: p.redfinUrl,
    regrid_url: p.regridUrl,
    google_maps_url: p.googleMapsUrl,
    red_flags: p.redFlags.join(" | "),
    notes: p.notes,
  }));

  return stringify(rows, { header: true, columns: [...COLUMNS] });
}

export const CSV_TEMPLATE = `sale_date,parcel_id,owner,address,tax_years,assessed_fmv,cry_out_bid,property_type_hint,county,state,city_hint
07/07/2026,05176A D012,EXAMPLE OWNER,10341 CANYON TRL,2024|2025,253500,10727.16,residential,Clayton,GA,Jonesboro
`;
