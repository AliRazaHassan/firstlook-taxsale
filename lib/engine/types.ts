import { z } from "zod";

export const BuyBoxSchema = z.object({
  name: z.string(),
  description: z.string(),
  preferResidential: z.boolean(),
  avoidVacantLand: z.boolean(),
  avoidLlcInvestorOwned: z.boolean(),
  maxTaxBurdenRatio: z.number(),
  minAssessedValue: z.number(),
  targetEquitySpreadMin: z.number(),
  weights: z.object({
    equitySpread: z.number(),
    taxBurden: z.number(),
    delinquencyYears: z.number(),
    propertyType: z.number(),
    neighborhoodValue: z.number(),
  }),
  redFlags: z.object({
    vacantLandKeywords: z.array(z.string()),
    lowAssessedValue: z.number(),
    highTaxBurdenRatio: z.number(),
    longDelinquencyYears: z.number(),
  }),
});

export type BuyBox = z.infer<typeof BuyBoxSchema>;

export const InputPropertySchema = z.object({
  sale_date: z.string().default(""),
  parcel_id: z.string().min(1),
  owner: z.string().default(""),
  address: z.string().min(1),
  tax_years: z.string().default(""),
  assessed_fmv: z.coerce.number(),
  cry_out_bid: z.coerce.number(),
  property_type_hint: z.string().default("unknown"),
  county: z.string().default("Clayton"),
  state: z.string().default("GA"),
  city_hint: z.string().optional().default(""),
});

export type InputProperty = z.infer<typeof InputPropertySchema>;

export type GeocodeResult = {
  matchedAddress: string | null;
  lat: number | null;
  lon: number | null;
  zip: string | null;
  city: string | null;
  matchedState: string | null;
  tract: string | null;
  countyFips: string | null;
  stateFips: string | null;
  geocodeStatus: "matched" | "unmatched";
};

export type AcsEnrichment = {
  tractMedianHomeValue: number | null;
  tractMedianIncome: number | null;
  tractName: string | null;
  acsVintage: string;
};

export type ResearchLinks = {
  assessorUrl: string;
  zillowUrl: string;
  redfinUrl: string;
  regridUrl: string;
  googleMapsUrl: string;
};

export type ScoredProperty = InputProperty &
  GeocodeResult &
  AcsEnrichment &
  ResearchLinks & {
    cleanAddress: string;
    taxYearsList: string[];
    delinquencyYears: number;
    taxBurdenRatio: number;
    equitySpread: number;
    estimatedMarketLow: number | null;
    estimatedMarketHigh: number | null;
    estimatedMarketMid: number | null;
    propertyType: string;
    redFlags: string[];
    notes: string;
    score: number;
    rank: number;
    lookAtFirst: boolean;
    maxBid?: number | null;
    projectedProfitAtMaxBid?: number | null;
  };

export type MaxBidInput = {
  arv: number;
  rehab: number;
  holdingMonths?: number;
  monthlyHolding?: number;
  closingBuyPct?: number;
  closingSellPct?: number;
  desiredProfit?: number;
  contingency?: number;
  cryOutBid?: number;
};

export type MaxBidResult = {
  maxBid: number;
  totalCosts: number;
  projectedProfit: number;
  equityVsCryOut: number | null;
  breakdown: {
    arv: number;
    rehab: number;
    holding: number;
    closingBuy: number;
    closingSell: number;
    desiredProfit: number;
    contingency: number;
  };
};
