import type { ScoredProperty } from "./types";
import type { CountyRules } from "./countyRules";

export type ChecklistItem = {
  id: string;
  label: string;
  severity: "required" | "recommended";
  autoHint?: string;
};

export function buildDiligenceChecklist(
  property: ScoredProperty,
  rules: CountyRules,
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "parcel-match",
      label: "Parcel / APN matches assessor legal description",
      severity: "required",
      autoHint: property.geocodeStatus === "matched" ? "Geocode matched an address" : "Geocode failed — verify manually",
    },
    {
      id: "access",
      label: "Physical access / not landlocked (map check)",
      severity: "required",
    },
    {
      id: "occupancy",
      label: "Occupancy / vacancy checked (no illegal contact)",
      severity: "required",
      autoHint: property.propertyType.includes("vacant") ? "Listed as likely vacant/low-value" : undefined,
    },
    {
      id: "surviving-liens",
      label: `Surviving liens reviewed (${rules.commonSurvivingLiens.slice(0, 2).join(", ")}…)`,
      severity: "required",
    },
    {
      id: "bankruptcy",
      label: "Owner bankruptcy search (PACER / counsel)",
      severity: "required",
    },
    {
      id: "max-bid-locked",
      label: "Hard max bid locked before auction (includes rehab + profit)",
      severity: "required",
      autoHint:
        property.maxBid != null
          ? `System max bid ≈ $${property.maxBid.toLocaleString()}`
          : "Set rehab + profit in Max bid tab",
    },
    {
      id: "redemption",
      label: `Redemption / sale-type rules understood (${rules.saleType.replace("_", " ")})`,
      severity: "required",
      autoHint: rules.redemptionSummary.slice(0, 120) + "…",
    },
    {
      id: "funds-ready",
      label: `Funds ready for payment window (${rules.paymentWindow.slice(0, 80)}…)`,
      severity: "required",
    },
    {
      id: "day-of-status",
      label: "Day-of: still on sale (not paid / withdrawn / stayed)",
      severity: "recommended",
    },
    {
      id: "comps",
      label: "Exit value sanity-checked with property-level sold comps",
      severity: "recommended",
      autoHint:
        property.tractMedianHomeValue != null
          ? `ACS tract median $${property.tractMedianHomeValue.toLocaleString()} is neighborhood context only`
          : "No ACS median — pull comps manually",
    },
  ];

  for (const extra of rules.diligenceExtras.slice(0, 3)) {
    items.push({
      id: `extra-${extra.slice(0, 12)}`,
      label: extra,
      severity: "recommended",
    });
  }

  return items;
}

export type ValuationConfidence = "medium" | "low";

export function valuationConfidence(property: ScoredProperty): {
  level: ValuationConfidence;
  label: string;
  detail: string;
} {
  if (property.geocodeStatus === "matched" && property.tractMedianHomeValue != null && property.assessed_fmv > 0) {
    return {
      level: "medium",
      label: "Medium confidence",
      detail: "Assessed FMV is cross-checked against ACS tract context. This is still not property-level comparable-sales evidence; verify sold comps before bidding.",
    };
  }
  if (property.assessed_fmv > 0) {
    return {
      level: "low",
      label: "Low confidence",
      detail: "Using assessed FMV without property-level sold comps. Treat this as a rough reference, not a decision-ready ARV.",
    };
  }
  return {
    level: "low",
    label: "Low confidence",
    detail: "Thin value data — treat as speculative until comps/title are done.",
  };
}

export function overbidRisk(property: ScoredProperty): {
  level: "ok" | "caution" | "danger";
  message: string;
} {
  if (property.maxBid == null || property.maxBid <= 0) {
    return { level: "caution", message: "No max bid set — do not bid live without a ceiling." };
  }
  if (property.cry_out_bid >= property.maxBid) {
    return {
      level: "danger",
      message: "Cry-out already at/above your max bid — WALK. Do not chase.",
    };
  }
  const headroom = property.maxBid - property.cry_out_bid;
  const pct = headroom / property.maxBid;
  if (pct < 0.15) {
    return {
      level: "caution",
      message: `Only ~${Math.round(pct * 100)}% headroom to max bid — easy to overbid under adrenaline.`,
    };
  }
  return {
    level: "ok",
    message: `Headroom to economic ceiling ≈ $${Math.round(headroom).toLocaleString()}. Verify comps, condition, title and auction terms; use the Deal Analyzer screening ceiling before deciding on a bid.`,
  };
}
