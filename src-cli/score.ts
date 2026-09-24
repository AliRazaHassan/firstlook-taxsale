import type { BuyBox, InputProperty, ScoredProperty } from "./types.js";
import { cleanStreetAddress } from "./ingest.js";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function classifyPropertyType(property: InputProperty, buyBox: BuyBox): string {
  const hint = property.property_type_hint.toLowerCase();
  const address = property.address.toUpperCase();
  if (hint.includes("vacant") || buyBox.redFlags.vacantLandKeywords.some((k) => address.includes(k))) {
    return "vacant_land";
  }
  if (hint.includes("related")) return "related_parcel";
  if (hint.includes("commercial")) return "commercial_or_mixed";
  if (hint.includes("residential")) return "residential";
  if (property.assessed_fmv < buyBox.redFlags.lowAssessedValue) return "likely_vacant_or_low_value";
  return "unknown";
}

export function collectRedFlags(
  property: InputProperty,
  buyBox: BuyBox,
  propertyType: string,
  taxBurdenRatio: number,
  delinquencyYears: number,
): string[] {
  const flags: string[] = [];
  if (propertyType === "vacant_land" || propertyType === "likely_vacant_or_low_value") {
    flags.push("Likely vacant / low-improvement parcel");
  }
  if (property.assessed_fmv < buyBox.redFlags.lowAssessedValue) {
    flags.push(`Low assessed FMV ($${property.assessed_fmv.toLocaleString()})`);
  }
  if (taxBurdenRatio >= buyBox.redFlags.highTaxBurdenRatio) {
    flags.push(`High tax burden vs FMV (${(taxBurdenRatio * 100).toFixed(1)}%)`);
  }
  if (delinquencyYears >= buyBox.redFlags.longDelinquencyYears) {
    flags.push(`Long delinquency (${delinquencyYears} years)`);
  }
  if (/\bLLC\b|\bINC\b|\bINSTITUTE\b|\bASSETS\b|\bINVESTMENTS\b|\bHOMES\b|\bENTERPRISES\b/i.test(property.owner)) {
    flags.push("Entity / investor owner — competition or packaging risk");
  }
  if (propertyType === "related_parcel") {
    flags.push("Related parcel — review with primary parcel");
  }
  if (!cleanStreetAddress(property.address).match(/^\d+/)) {
    flags.push("Incomplete street number — verify location carefully");
  }
  return flags;
}

export function buildNotes(
  property: InputProperty,
  propertyType: string,
  equitySpread: number,
  taxBurdenRatio: number,
  tractMedian: number | null,
  estimatedMid: number | null,
  redFlags: string[],
): string {
  const parts: string[] = [];
  parts.push(
    `Cry-out bid $${property.cry_out_bid.toLocaleString()} vs assessed FMV $${property.assessed_fmv.toLocaleString()} (${(equitySpread * 100).toFixed(0)}% spread).`,
  );
  if (estimatedMid != null) {
    parts.push(`Blended market estimate ~$${Math.round(estimatedMid).toLocaleString()}.`);
  }
  if (tractMedian != null) {
    parts.push(`ACS tract median home value $${tractMedian.toLocaleString()}.`);
  }
  parts.push(`Tax burden ${(taxBurdenRatio * 100).toFixed(1)}% of assessed FMV.`);
  parts.push(`Type: ${propertyType.replaceAll("_", " ")}.`);
  if (redFlags.length) {
    parts.push(`Flags: ${redFlags.join("; ")}.`);
  } else {
    parts.push("No major automated red flags.");
  }
  return parts.join(" ");
}

export function scoreProperty(args: {
  property: InputProperty;
  buyBox: BuyBox;
  propertyType: string;
  taxBurdenRatio: number;
  delinquencyYears: number;
  equitySpread: number;
  tractMedianHomeValue: number | null;
}): number {
  const { property, buyBox, propertyType, taxBurdenRatio, delinquencyYears, equitySpread, tractMedianHomeValue } =
    args;
  const w = buyBox.weights;

  // Higher equity spread (FMV - bid)/FMV is better
  const equityScore = clamp((equitySpread / Math.max(buyBox.targetEquitySpreadMin, 0.01)) * 100);

  // Lower tax burden is better
  const taxScore = clamp(100 - (taxBurdenRatio / buyBox.maxTaxBurdenRatio) * 100);

  // Mild preference for shorter delinquency (less complexity), but not zero years only
  const delinquencyScore = clamp(100 - Math.max(0, delinquencyYears - 2) * 20);

  let typeScore = 55;
  if (propertyType === "residential") typeScore = buyBox.preferResidential ? 95 : 80;
  if (propertyType === "commercial_or_mixed") typeScore = 60;
  if (propertyType === "related_parcel") typeScore = 40;
  if (propertyType === "vacant_land" || propertyType === "likely_vacant_or_low_value") {
    typeScore = buyBox.avoidVacantLand ? 15 : 45;
  }

  let neighborhoodScore = 50;
  if (tractMedianHomeValue != null && property.assessed_fmv > 0) {
    const ratio = property.assessed_fmv / tractMedianHomeValue;
    // Prefer properties near or above neighborhood median (less distressed area signal)
    if (ratio >= 0.85 && ratio <= 1.35) neighborhoodScore = 90;
    else if (ratio >= 0.65) neighborhoodScore = 70;
    else if (ratio >= 0.4) neighborhoodScore = 45;
    else neighborhoodScore = 25;
  }

  if (property.assessed_fmv < buyBox.minAssessedValue) {
    typeScore = Math.min(typeScore, 30);
  }

  const totalWeight = w.equitySpread + w.taxBurden + w.delinquencyYears + w.propertyType + w.neighborhoodValue;
  const raw =
    (equityScore * w.equitySpread +
      taxScore * w.taxBurden +
      delinquencyScore * w.delinquencyYears +
      typeScore * w.propertyType +
      neighborhoodScore * w.neighborhoodValue) /
    totalWeight;

  return Math.round(clamp(raw) * 10) / 10;
}

export function estimateMarketRange(
  assessedFmv: number,
  tractMedian: number | null,
): { low: number | null; mid: number | null; high: number | null } {
  if (!assessedFmv && !tractMedian) {
    return { low: null, mid: null, high: null };
  }
  if (assessedFmv && tractMedian) {
    const mid = assessedFmv * 0.55 + tractMedian * 0.45;
    return {
      low: Math.round(mid * 0.88),
      mid: Math.round(mid),
      high: Math.round(mid * 1.12),
    };
  }
  const base = assessedFmv || tractMedian || 0;
  return {
    low: Math.round(base * 0.9),
    mid: Math.round(base),
    high: Math.round(base * 1.1),
  };
}

export function assignRanks(rows: Omit<ScoredProperty, "rank" | "lookAtFirst">[]): ScoredProperty[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const ranked = sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    lookAtFirst: false,
  }));

  let picks = 0;
  for (const row of ranked) {
    if (picks >= 5) break;
    if (row.score < 55) continue;
    if (row.propertyType.includes("vacant")) continue;
    if (row.redFlags.some((f) => /investor owner/i.test(f))) continue;
    if (row.propertyType === "related_parcel") continue;
    row.lookAtFirst = true;
    picks += 1;
  }

  // If buy-box filters left fewer than 5, fill with next-best residential scores
  if (picks < 5) {
    for (const row of ranked) {
      if (picks >= 5) break;
      if (row.lookAtFirst) continue;
      if (row.score < 55) continue;
      if (row.propertyType.includes("vacant")) continue;
      row.lookAtFirst = true;
      picks += 1;
    }
  }

  return ranked;
}
