import { parse } from "csv-parse/sync";
import { InputPropertySchema, type InputProperty } from "./types";

export function cleanStreetAddress(address: string): string {
  return address
    .replace(/\s*\(related parcel\)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTaxSaleCsv(text: string): InputProperty[] {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (!rows.length) throw new Error("CSV has no data rows");

  return rows.map((row, index) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = value;
    }

    const mapped = {
      sale_date: normalized.sale_date ?? normalized.date ?? "",
      parcel_id: normalized.parcel_id ?? normalized.parcel ?? normalized.apn ?? "",
      owner: normalized.owner ?? normalized.name ?? "",
      address: normalized.address ?? normalized.property_location ?? "",
      tax_years: (normalized.tax_years ?? normalized.years ?? "").replace(/,/g, "|"),
      assessed_fmv: normalized.assessed_fmv ?? normalized.fmv ?? normalized.fair_market_value ?? "0",
      cry_out_bid: normalized.cry_out_bid ?? normalized.bid ?? normalized.amount_due ?? "0",
      property_type_hint: normalized.property_type_hint ?? normalized.type ?? "unknown",
      county: normalized.county ?? "Clayton",
      state: normalized.state ?? "GA",
      city_hint: normalized.city_hint ?? normalized.city ?? "",
    };

    const parsed = InputPropertySchema.safeParse(mapped);
    if (!parsed.success) {
      throw new Error(`Invalid row ${index + 2}: ${parsed.error.issues[0]?.message ?? "bad data"}`);
    }
    return parsed.data;
  });
}
