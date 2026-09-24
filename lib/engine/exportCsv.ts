import { stringify } from "csv-stringify/sync";
import type { ScoredProperty } from "./types";

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

export function propertiesToCsv(properties: ScoredProperty[]): string {
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
