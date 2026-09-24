import { stringify } from "csv-stringify/sync";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ScoredProperty } from "./types.js";

const COLUMNS = [
  "rank",
  "look_at_first",
  "score",
  "address",
  "matched_address",
  "parcel_apn",
  "owner",
  "property_type",
  "sale_date",
  "tax_years",
  "assessed_fmv",
  "cry_out_bid",
  "equity_spread_pct",
  "tax_burden_pct",
  "estimated_market_low",
  "estimated_market_mid",
  "estimated_market_high",
  "tract_median_home_value",
  "tract_median_income",
  "tract_name",
  "acs_vintage",
  "lat",
  "lon",
  "zip",
  "assessor_url",
  "zillow_url",
  "redfin_url",
  "regrid_url",
  "google_maps_url",
  "red_flags",
  "notes",
  "geocode_status",
] as const;

function toRow(p: ScoredProperty): Record<(typeof COLUMNS)[number], string | number | boolean> {
  return {
    rank: p.rank,
    look_at_first: p.lookAtFirst ? "YES" : "",
    score: p.score,
    address: p.cleanAddress,
    matched_address: p.matchedAddress ?? "",
    parcel_apn: p.parcel_id,
    owner: p.owner,
    property_type: p.propertyType,
    sale_date: p.sale_date,
    tax_years: p.taxYearsList.join(", "),
    assessed_fmv: p.assessed_fmv,
    cry_out_bid: p.cry_out_bid,
    equity_spread_pct: Math.round(p.equitySpread * 1000) / 10,
    tax_burden_pct: Math.round(p.taxBurdenRatio * 1000) / 10,
    estimated_market_low: p.estimatedMarketLow ?? "",
    estimated_market_mid: p.estimatedMarketMid ?? "",
    estimated_market_high: p.estimatedMarketHigh ?? "",
    tract_median_home_value: p.tractMedianHomeValue ?? "",
    tract_median_income: p.tractMedianIncome ?? "",
    tract_name: p.tractName ?? "",
    acs_vintage: p.acsVintage,
    lat: p.lat ?? "",
    lon: p.lon ?? "",
    zip: p.zip ?? "",
    assessor_url: p.assessorUrl,
    zillow_url: p.zillowUrl,
    redfin_url: p.redfinUrl,
    regrid_url: p.regridUrl,
    google_maps_url: p.googleMapsUrl,
    red_flags: p.redFlags.join(" | "),
    notes: p.notes,
    geocode_status: p.geocodeStatus,
  };
}

export function exportCsv(properties: ScoredProperty[], outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(outputDir, `taxsale-research-${stamp}.csv`);
  const latestPath = path.join(outputDir, "taxsale-research-latest.csv");
  const rows = properties.map(toRow);
  const csv = stringify(rows, { header: true, columns: [...COLUMNS] });
  writeFileSync(filePath, csv, "utf8");
  writeFileSync(latestPath, csv, "utf8");
  writeFileSync(
    path.join(outputDir, "taxsale-research-latest.json"),
    JSON.stringify(properties, null, 2),
    "utf8",
  );
  return latestPath;
}
