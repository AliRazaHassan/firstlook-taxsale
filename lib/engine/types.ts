import { z } from "zod";

export const BuyBoxSchema = z.object({
  name: z.string(),
  description: z.string(),
  preferResidential: z.boolean(),
  avoidVacantLand: z.boolean(),
  avoidLlcInvestorOwned: z.boolean(),
  maxTaxBurdenRatio: z.number().finite().min(0.001).max(1),
  minAssessedValue: z.number().finite().min(0).max(100_000_000),
  targetEquitySpreadMin: z.number().finite().min(0.01).max(1),
  minEquitySpread: z.number().finite().min(-1).max(1),
  maxCryOutBid: z.number().finite().min(0).max(100_000_000),
  minLookFirstScore: z.number().finite().min(0).max(100),
  maxLookFirst: z.number().int().min(1).max(25),
  weights: z.object({
    equitySpread: z.number().finite().min(0).max(100),
    taxBurden: z.number().finite().min(0).max(100),
    delinquencyYears: z.number().finite().min(0).max(100),
    propertyType: z.number().finite().min(0).max(100),
    neighborhoodValue: z.number().finite().min(0).max(100),
  }),
  redFlags: z.object({
    vacantLandKeywords: z.array(z.string()),
    lowAssessedValue: z.number().finite().min(0).max(100_000_000),
    highTaxBurdenRatio: z.number().finite().min(0).max(1),
    longDelinquencyYears: z.number().finite().min(1).max(50),
  }),
});

export type BuyBox = z.infer<typeof BuyBoxSchema>;

export const InputPropertySchema = z.object({
  sale_date: z.string().default(""),
  parcel_id: z.string().trim().min(1).max(120),
  owner: z.string().trim().max(250).default(""),
  address: z.string().trim().min(1).max(300),
  tax_years: z.string().trim().max(250).default(""),
  assessed_fmv: z.coerce.number().finite().min(0).max(100_000_000),
  cry_out_bid: z.coerce.number().finite().min(0).max(100_000_000),
  property_type_hint: z.string().trim().max(120).default("unknown"),
  county: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(40),
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
    dealTruth?: {
      overall: number;
      opportunity: number;
      valuation: number;
      titleLegal: number;
      auctionSafety: number;
      liquidity: number;
      confidence: "low" | "medium";
      reasons: string[];
    };
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
  titleLegal?: number;
  survivingLiens?: number;
  evictionPossession?: number;
  auctionFees?: number;
  redemptionCarry?: number;
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
    titleLegal: number;
    survivingLiens: number;
    evictionPossession: number;
    auctionFees: number;
    redemptionCarry: number;
  };
};
