import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { InputPropertySchema, type InputProperty } from "./types.js";

export function loadTaxSaleCsv(filePath: string): InputProperty[] {
  const text = readFileSync(filePath, "utf8");
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows.map((row, index) => {
    const parsed = InputPropertySchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Invalid row ${index + 2}: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}

export function cleanStreetAddress(address: string): string {
  return address
    .replace(/\s*\(related parcel\)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
