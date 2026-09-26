/** County rule packs — informational only. Always verify official sale terms before bidding. */

export type CountyRules = {
  id: string;
  state: string;
  county: string;
  saleType: "tax_deed" | "tax_lien" | "hybrid";
  label: string;
  redemptionSummary: string;
  paymentWindow: string;
  commonSurvivingLiens: string[];
  diligenceExtras: string[];
  overbidWarning: string;
  sourcesNote: string;
};

export const COUNTY_RULES: CountyRules[] = [
  {
    id: "ga-clayton",
    state: "GA",
    county: "Clayton",
    saleType: "tax_deed",
    label: "Georgia · Clayton County (tax deed)",
    redemptionSummary:
      "Georgia tax sales are generally deed-oriented; confirm current Clayton Sheriff/Tax Commissioner rules and any post-sale challenges before renovating.",
    paymentWindow:
      "Winning bidders typically must pay quickly per sale terms — bring liquid funds; deposits and balance deadlines vary by posting.",
    commonSurvivingLiens: ["IRS federal tax liens (may survive)", "Municipal utility / code liens (check city)", "HOA / condo assessments (often survive)", "Demolition or special assessment liens"],
    diligenceExtras: ["Match parcel ID to qPublic legal description", "Check bankruptcy PACER for owner name", "Drive-by or street-view for occupancy / condition", "Confirm sale not paid/withdrawn day-of"],
    overbidWarning: "Auction adrenaline causes overbids. Lock max bid before the sale and walk when you hit it.",
    sourcesNote: "Verify on Clayton County Tax Commissioner / Sheriff tax-sale page before bidding.",
  },
  {
    id: "fl-generic", state: "FL", county: "Statewide pattern", saleType: "hybrid",
    label: "Florida pattern (certificate → tax deed)",
    redemptionSummary: "Florida commonly uses tax certificates first; tax deeds follow later. Certificate holders and statutory redemption windows matter — confirm county clerk rules.",
    paymentWindow: "Online auctions via county platforms; registration and deposit deadlines are strict.",
    commonSurvivingLiens: ["Federal tax liens", "Municipal liens / code enforcement", "HOA liens", "Possible superior interests — title search required"],
    diligenceExtras: ["Confirm certificate vs deed sale type", "Check FloridaClerk / county auction portal status", "Flood zone + insurance feasibility", "Quiet title budget if exit needs marketable title"],
    overbidWarning: "Florida deeds can look cheap until quiet title + surviving liens are priced in.",
    sourcesNote: "Generic state pattern only. Confirm on the specific county tax collector / clerk auction site.",
  },
  {
    id: "tx-generic", state: "TX", county: "Statewide pattern", saleType: "tax_deed",
    label: "Texas pattern (tax deed + redemption)",
    redemptionSummary: "Texas tax sales may include post-sale redemption. The applicable period depends on the property and current law; confirm the statute, judgment, and sale terms.",
    paymentWindow: "Sheriff / constable sales; payment timing is unforgiving after winning bid.",
    commonSurvivingLiens: ["IRS liens", "Some municipal claims", "HOA assessments", "Access / easement disputes on land"],
    diligenceExtras: ["Confirm redemption class and current statutory period", "Do not major-renovate until redemption/title risk is understood", "Verify legal description vs appraisal district", "Check for multiple tracts bundled under one judgment"],
    overbidWarning: "Ignoring redemption/title risk can tie up capital and change the economics of a deal.",
    sourcesNote: "Generic state pattern only. Confirm with the county appraisal district, taxing authority, sheriff/constable posting, and counsel as appropriate.",
  },
];

export function resolveCountyRules(state?: string, county?: string): CountyRules {
  const s = (state ?? "").trim().toUpperCase();
  const c = (county ?? "").trim().toLowerCase();
  const exact = COUNTY_RULES.find((r) => r.state === s && r.county.toLowerCase() === c);
  if (exact) return exact;

  const generic = COUNTY_RULES.find(
    (r) => r.state === s && r.county.toLowerCase() === "statewide pattern",
  );
  if (generic) return generic;

  return {
    id: `unverified-${s || "unknown"}-${c || "unknown"}`,
    state: s || "UNKNOWN",
    county: county?.trim() || "Unknown county",
    saleType: "hybrid",
    label: `${county?.trim() || "Unknown county"}, ${s || "unknown state"} — rules not loaded`,
    redemptionSummary: "No verified rule pack is loaded for this jurisdiction. Do not infer redemption or title rules from another county/state.",
    paymentWindow: "Unknown — verify the current official auction notice and sale terms before bidding.",
    commonSurvivingLiens: ["Unknown — obtain a jurisdiction-specific title/lien review before bidding"],
    diligenceExtras: ["Verify sale type and redemption rules", "Verify payment/deposit deadlines", "Verify title and surviving liens", "Verify parcel/legal description against official records"],
    overbidWarning: "Do not bid from generic assumptions. Lock a max bid only after jurisdiction-specific costs and risks are verified.",
    sourcesNote: "No jurisdiction-specific source pack is loaded. Use the official county/taxing authority sale notice and qualified legal/title guidance.",
  };
}
