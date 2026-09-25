/** County rule packs — Phase 3/4 core. Expand per state as clients onboard. */

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
    commonSurvivingLiens: [
      "IRS federal tax liens (may survive)",
      "Municipal utility / code liens (check city)",
      "HOA / condo assessments (often survive)",
      "Demolition or special assessment liens",
    ],
    diligenceExtras: [
      "Match parcel ID to qPublic legal description",
      "Check bankruptcy PACER for owner name",
      "Drive-by or street-view for occupancy / condition",
      "Confirm sale not paid/withdrawn day-of",
    ],
    overbidWarning:
      "Auction adrenaline causes overbids. Lock max bid before the sale and walk when you hit it.",
    sourcesNote: "Verify on Clayton County Tax Commissioner / Sheriff tax-sale page before bidding.",
  },
  {
    id: "fl-generic",
    state: "FL",
    county: "Statewide pattern",
    saleType: "hybrid",
    label: "Florida pattern (certificate → tax deed)",
    redemptionSummary:
      "Florida commonly uses tax certificates first; tax deeds follow later. Certificate holders and statutory redemption windows matter — confirm county clerk rules.",
    paymentWindow: "Online auctions via county platforms; registration and deposit deadlines are strict.",
    commonSurvivingLiens: [
      "Federal tax liens",
      "Municipal liens / code enforcement",
      "HOA liens",
      "Possible superior interests — title search required",
    ],
    diligenceExtras: [
      "Confirm certificate vs deed sale type",
      "Check FloridaClerk / county auction portal status",
      "Flood zone + insurance feasibility",
      "Quiet title budget if exit needs marketable title",
    ],
    overbidWarning: "Florida deeds can look cheap until quiet title + surviving liens are priced in.",
    sourcesNote: "Confirm on the specific county tax collector / clerk auction site.",
  },
  {
    id: "tx-generic",
    state: "TX",
    county: "Statewide pattern",
    saleType: "tax_deed",
    label: "Texas pattern (tax deed + redemption)",
    redemptionSummary:
      "Texas often allows post-sale redemption (commonly ~180 days; longer for homestead/ag — confirm statute and deed recording date).",
    paymentWindow: "Sheriff / constable sales; payment timing is unforgiving after winning bid.",
    commonSurvivingLiens: [
      "IRS liens",
      "Some municipal claims",
      "HOA assessments",
      "Access / easement disputes on land",
    ],
    diligenceExtras: [
      "Confirm redemption class (homestead vs non-homestead)",
      "Do not major-renovate until redemption clears",
      "Verify legal description vs appraisal district",
      "Check for multiple tracts bundled under one judgment",
    ],
    overbidWarning: "Ignore redemption and you can fund a deal you do not control for months.",
    sourcesNote: "Confirm with county appraisal district + sheriff sale posting.",
  },
];

export function resolveCountyRules(state?: string, county?: string): CountyRules {
  const s = (state ?? "").toUpperCase();
  const c = (county ?? "").toLowerCase();
  const exact = COUNTY_RULES.find(
    (r) => r.state === s && r.county.toLowerCase() === c,
  );
  if (exact) return exact;
  const byState = COUNTY_RULES.find((r) => r.state === s);
  return byState ?? COUNTY_RULES[0];
}
