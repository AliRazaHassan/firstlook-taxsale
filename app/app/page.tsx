"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BidGauge, FunnelChart, ScoreBars, SparkBars, WorkflowDiagram } from "@/components/Charts";
import {
  DEFAULT_BUY_BOX,
  calculateMaxBid,
  calculateDealTruthScore,
  impactStats,
  normalizeBuyBox,
  rescoreExisting,
  type BuyBox,
  type ScoredProperty,
} from "@/lib/engine";
import { money, pct } from "@/lib/format";
import styles from "./app.module.css";

type Impact = {
  total: number;
  lookFirst: number;
  flagged: number;
  skipped: number;
  hoursSaved: number;
  problemSolvedPct: number;
  headline: string;
};

type ResearchResponse = {
  mode: string;
  county?: string;
  saleDate?: string;
  total: number;
  lookFirstCount: number;
  geocoded: number;
  impact?: Impact;
  properties: ScoredProperty[];
  error?: string;
};

type FilterMode = "all" | "look" | "flagged" | "clean" | "headroom" | "overbid";
type SortMode = "rank" | "score" | "maxBid" | "cryOut" | "spread";
type SideTab = "research" | "buybox" | "bid" | "watch";
type OsModule = "taxsale" | "property360" | "analyzer" | "comps" | "rehab" | "financing" | "diligence" | "pipeline" | "portfolio";
type DealStrategy = "flip" | "rental" | "brrrr";
type ConciergeMessage = { role: "user" | "assistant"; text: string };
type AiContextMenu = { x: number; y: number; label: string; value: string } | null;
type ManualComp = { id: number; address: string; salePrice: number; sqft: number; distanceMiles: number; adjustment: number };
type RehabKey = "roof" | "hvac" | "kitchen" | "bathrooms" | "flooringPaint" | "electricalPlumbing" | "exterior" | "permitsOther";

const PIPELINE_STAGES = ["New","Researching","Due diligence","Offer","Under contract","Rehab","Listed / Rented","Exited"] as const;
const REHAB_LABELS: Record<RehabKey,string> = {
  roof: "Roof",
  hvac: "HVAC",
  kitchen: "Kitchen",
  bathrooms: "Bathrooms",
  flooringPaint: "Flooring + paint",
  electricalPlumbing: "Electrical + plumbing",
  exterior: "Exterior / landscaping",
  permitsOther: "Permits + other",
};

type DiligencePayload = {
  rules: {
    label: string;
    saleType: string;
    redemptionSummary: string;
    paymentWindow: string;
    overbidWarning: string;
    commonSurvivingLiens: string[];
  };
  checklist: Array<{ id: string; label: string; severity: string; autoHint?: string }>;
  valuation: { level: string; label: string; detail: string };
  overbid: { level: string; message: string };
};

type BidDefaults = {
  rehab: number;
  holdingMonths: number;
  monthlyHolding: number;
  desiredProfitPct: number;
  closingBuyPct: number;
  closingSellPct: number;
  contingencyPct: number;
  titleLegal: number;
  survivingLiens: number;
  evictionPossession: number;
  auctionFees: number;
  redemptionCarry: number;
};

const BUY_BOX_KEY = "firstlook-buy-box-v3";
const BID_KEY = "firstlook-bid-defaults-v3";

const DEFAULT_BID_DEFAULTS: BidDefaults = {
  rehab: 25000,
  holdingMonths: 4,
  monthlyHolding: 500,
  desiredProfitPct: 15,
  closingBuyPct: 2,
  closingSellPct: 8,
  contingencyPct: 10,
  titleLegal: 0,
  survivingLiens: 0,
  evictionPossession: 0,
  auctionFees: 0,
  redemptionCarry: 0,
};

function normalizeBidDefaults(raw?: Partial<BidDefaults>): BidDefaults {
  const v = { ...DEFAULT_BID_DEFAULTS, ...(raw ?? {}) };
  const moneyValue = (n: number) => Math.max(0, Math.min(100_000_000, Number(n) || 0));
  const pctValue = (n: number, max = 100) => Math.max(0, Math.min(max, Number(n) || 0));
  return {
    rehab: moneyValue(v.rehab),
    holdingMonths: Math.max(0, Math.min(120, Math.round(Number(v.holdingMonths) || 0))),
    monthlyHolding: moneyValue(v.monthlyHolding),
    desiredProfitPct: pctValue(v.desiredProfitPct),
    closingBuyPct: pctValue(v.closingBuyPct, 25),
    closingSellPct: pctValue(v.closingSellPct, 35),
    contingencyPct: pctValue(v.contingencyPct),
    titleLegal: moneyValue(v.titleLegal),
    survivingLiens: moneyValue(v.survivingLiens),
    evictionPossession: moneyValue(v.evictionPossession),
    auctionFees: moneyValue(v.auctionFees),
    redemptionCarry: moneyValue(v.redemptionCarry),
  };
}

function cloneDefaultBuyBox(): BuyBox {
  return normalizeBuyBox(DEFAULT_BUY_BOX);
}

function loadBuyBox(): BuyBox {
  if (typeof window === "undefined") return cloneDefaultBuyBox();
  try {
    const raw = localStorage.getItem(BUY_BOX_KEY);
    if (!raw) return cloneDefaultBuyBox();
    return normalizeBuyBox(JSON.parse(raw));
  } catch {
    return cloneDefaultBuyBox();
  }
}

function loadBidDefaults(): BidDefaults {
  if (typeof window === "undefined") return normalizeBidDefaults();
  try {
    const raw = localStorage.getItem(BID_KEY);
    return normalizeBidDefaults(raw ? JSON.parse(raw) as Partial<BidDefaults> : undefined);
  } catch {
    return normalizeBidDefaults();
  }
}

function hasHeadroom(p: ScoredProperty): boolean {
  return p.maxBid != null && p.maxBid > 0 && p.cry_out_bid < p.maxBid * 0.85;
}

function isOverbidRisk(p: ScoredProperty): boolean {
  return p.maxBid == null || p.maxBid <= 0 || p.cry_out_bid >= p.maxBid;
}

const DEAL_PERCENT_FIELDS = new Set(["downPaymentPct","interestRate","vacancyPct","managementPct","buyClosingPct","sellClosingPct","contingencyPct","refiLtvPct","refiClosingPct","targetProfitPct"]);
function normalizeDealInput(key: string, raw: number): number {
  const value = Number.isFinite(raw) ? raw : 0;
  if (DEAL_PERCENT_FIELDS.has(key)) return Math.max(0, Math.min(100, value));
  if (key === "loanYears") return Math.max(1, Math.min(50, value));
  if (key === "holdingMonths") return Math.max(0, Math.min(120, value));
  return Math.max(0, Math.min(100_000_000, value));
}

export default function AppPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [osModule, setOsModule] = useState<OsModule>("taxsale");
  const [dealStrategy, setDealStrategy] = useState<DealStrategy>("flip");
  const [dealInputs, setDealInputs] = useState({ purchasePrice: 0, arv: 0, rehab: 25000, monthlyRent: 0, downPaymentPct: 20, interestRate: 7.5, loanYears: 30, vacancyPct: 5, managementPct: 8, taxesMonthly: 0, insuranceMonthly: 0, otherMonthly: 0, buyClosingPct: 2, sellClosingPct: 8, holdingMonths: 6, monthlyHolding: 650, contingencyPct: 10, targetProfitPct: 15, refiLtvPct: 75, refiClosingPct: 3, titleLegal: 0, survivingLiens: 0, evictionPossession: 0, auctionFees: 0, redemptionCarry: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState<ScoredProperty | null>(null);
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [sideTab, setSideTab] = useState<SideTab>("research");
  const [buyBox, setBuyBox] = useState<BuyBox>(loadBuyBox);
  const [bidDefaults, setBidDefaults] = useState<BidDefaults>(loadBidDefaults);
  const [diligence, setDiligence] = useState<DiligencePayload | null>(null);
  const [watchEmail, setWatchEmail] = useState("");
  const [watchCounty, setWatchCounty] = useState("Clayton");
  const [watchState, setWatchState] = useState("GA");
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [conciergeQuestion, setConciergeQuestion] = useState("");
  const [conciergeMessages, setConciergeMessages] = useState<ConciergeMessage[]>([
    { role: "assistant", text: "Select a property, then ask me about any score, bid, risk or diligence result. Tip: right-click a stat and choose Ask AI about this." },
  ]);
  const [conciergeLoading, setConciergeLoading] = useState(false);
  const [aiContextMenu, setAiContextMenu] = useState<AiContextMenu>(null);
  const [engineerKey, setEngineerKey] = useState("");
  const [subjectSqft, setSubjectSqft] = useState(0);
  const [manualComps, setManualComps] = useState<ManualComp[]>([
    { id: 1, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
    { id: 2, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
    { id: 3, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
  ]);
  const [rehabItems, setRehabItems] = useState<Record<RehabKey,number>>({
    roof: 0, hvac: 0, kitchen: 0, bathrooms: 0, flooringPaint: 0,
    electricalPlumbing: 0, exterior: 0, permitsOther: 25000,
  });
  const [pipelineStage, setPipelineStage] = useState<(typeof PIPELINE_STAGES)[number]>("Researching");
  const [pipelineNote, setPipelineNote] = useState("");
  const conciergeScrollRef = useRef<HTMLDivElement | null>(null);

  const buyBoxRef = useRef(buyBox);
  const bidRef = useRef(bidDefaults);
  buyBoxRef.current = buyBox;
  bidRef.current = bidDefaults;

  const bidPayload = useMemo(() => {
    const b = normalizeBidDefaults(bidDefaults);
    return {
      rehab: b.rehab,
      holdingMonths: b.holdingMonths,
      monthlyHolding: b.monthlyHolding,
      desiredProfitPct: b.desiredProfitPct / 100,
      closingBuyPct: b.closingBuyPct / 100,
      closingSellPct: b.closingSellPct / 100,
      contingencyPct: b.contingencyPct / 100,
      titleLegal: b.titleLegal,
      survivingLiens: b.survivingLiens,
      evictionPossession: b.evictionPossession,
      auctionFees: b.auctionFees,
      redemptionCarry: b.redemptionCarry,
    };
  }, [bidDefaults]);

  const applyResponse = useCallback((json: ResearchResponse, keepParcelId?: string | null) => {
    setData(json);
    setSelected((prev) => {
      const want = keepParcelId ?? prev?.parcel_id;
      const kept = want ? json.properties.find((p) => p.parcel_id === want) : undefined;
      return kept ?? json.properties.find((p) => p.lookAtFirst) ?? json.properties[0] ?? null;
    });
  }, []);

  const applyLocalRescore = useCallback(
    (properties: ScoredProperty[], mode = "rescored") => {
      const box = normalizeBuyBox(buyBoxRef.current);
      const bid = normalizeBidDefaults(bidRef.current);
      const next = rescoreExisting(properties, box, {
        rehab: bid.rehab,
        holdingMonths: bid.holdingMonths,
        monthlyHolding: bid.monthlyHolding,
        desiredProfitPct: bid.desiredProfitPct / 100,
        closingBuyPct: bid.closingBuyPct / 100,
        closingSellPct: bid.closingSellPct / 100,
        contingencyPct: bid.contingencyPct / 100,
        titleLegal: bid.titleLegal,
        survivingLiens: bid.survivingLiens,
        evictionPossession: bid.evictionPossession,
        auctionFees: bid.auctionFees,
        redemptionCarry: bid.redemptionCarry,
      });
      const impact = impactStats(next);
      return {
        mode,
        total: next.length,
        lookFirstCount: impact.lookFirst,
        geocoded: next.filter((p) => p.geocodeStatus === "matched").length,
        impact,
        properties: next,
      } satisfies ResearchResponse;
    },
    [],
  );

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus("Loading Clayton County demo…");
    try {
      const res = await fetch("/api/demo");
      const json = (await res.json()) as ResearchResponse;
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Demo failed");
      const scored = applyLocalRescore(json.properties, "demo");
      applyResponse({ ...json, ...scored });
      setStatus(`Demo ready · ${scored.total} parcels · your max-bid settings applied`);
      setFilter("look");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo");
    } finally {
      setLoading(false);
    }
  }, [applyLocalRescore, applyResponse]);

  useEffect(() => {
    void loadDemo();
  }, [loadDemo]);

  useEffect(() => {
    localStorage.setItem(BUY_BOX_KEY, JSON.stringify(buyBox));
  }, [buyBox]);

  useEffect(() => {
    localStorage.setItem(BID_KEY, JSON.stringify(bidDefaults));
  }, [bidDefaults]);

  useEffect(() => {
    if (!selected) {
      setDiligence(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/diligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property: selected }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) setDiligence(json as DiligencePayload);
      } catch {
        if (!cancelled) setDiligence(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected?.parcel_id) {
      setCheckedItems({});
      return;
    }
    try {
      const raw = localStorage.getItem(`firstlook-check-${selected.parcel_id}`);
      setCheckedItems(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setCheckedItems({});
    }
  }, [selected?.parcel_id]);

  useEffect(() => {
    if (!selected?.parcel_id) return;
    localStorage.setItem(`firstlook-check-${selected.parcel_id}`, JSON.stringify(checkedItems));
  }, [checkedItems, selected?.parcel_id]);

  const filterCounts = useMemo(() => {
    const props = data?.properties ?? [];
    return {
      all: props.length,
      look: props.filter((p) => p.lookAtFirst).length,
      flagged: props.filter((p) => p.redFlags.length > 0).length,
      clean: props.filter((p) => p.redFlags.length === 0).length,
      headroom: props.filter(hasHeadroom).length,
      overbid: props.filter(isOverbidRisk).length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let rows = data.properties.filter((p) => {
      if (minScore > 0 && p.score < minScore) return false;
      if (filter === "look" && !p.lookAtFirst) return false;
      if (filter === "flagged" && p.redFlags.length === 0) return false;
      if (filter === "clean" && p.redFlags.length > 0) return false;
      if (filter === "headroom" && !hasHeadroom(p)) return false;
      if (filter === "overbid" && !isOverbidRisk(p)) return false;
      if (!q) return true;
      return (
        p.cleanAddress.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        p.parcel_id.toLowerCase().includes(q) ||
        (p.matchedAddress?.toLowerCase().includes(q) ?? false)
      );
    });

    rows = [...rows].sort((a, b) => {
      switch (sortMode) {
        case "score":
          return b.score - a.score;
        case "maxBid":
          return (b.maxBid ?? 0) - (a.maxBid ?? 0);
        case "cryOut":
          return a.cry_out_bid - b.cry_out_bid;
        case "spread":
          return b.equitySpread - a.equitySpread;
        default:
          return a.rank - b.rank;
      }
    });

    return rows;
  }, [data, filter, query, minScore, sortMode]);

  const impact = data?.impact;

  const scoreSpark = useMemo(() => {
    if (!data?.properties.length) return [];
    return [...data.properties]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 12)
      .map((p) => p.score);
  }, [data]);

  useEffect(() => {
    if (!selected) return;
    const b = normalizeBidDefaults(bidDefaults);
    setDealInputs((v) => ({
      ...v,
      purchasePrice: selected.cry_out_bid,
      arv: selected.estimatedMarketMid ?? selected.assessed_fmv,
      rehab: b.rehab,
      monthlyRent: 0,
      taxesMonthly: 0,
      insuranceMonthly: 0,
      buyClosingPct: b.closingBuyPct,
      sellClosingPct: b.closingSellPct,
      contingencyPct: b.contingencyPct,
      targetProfitPct: b.desiredProfitPct,
      titleLegal: b.titleLegal,
      survivingLiens: b.survivingLiens,
      evictionPossession: b.evictionPossession,
      auctionFees: b.auctionFees,
      redemptionCarry: b.redemptionCarry,
    }));
    setSubjectSqft(0);
    setManualComps([
      { id: 1, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
      { id: 2, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
      { id: 3, address: "", salePrice: 0, sqft: 0, distanceMiles: 0, adjustment: 0 },
    ]);
    setRehabItems({
      roof: 0, hvac: 0, kitchen: 0, bathrooms: 0, flooringPaint: 0,
      electricalPlumbing: 0, exterior: 0, permitsOther: b.rehab,
    });
  }, [selected?.parcel_id]);

  const compAnalysis = useMemo(() => {
    const valid = manualComps
      .filter((comp) => comp.salePrice > 0 && comp.sqft > 0)
      .map((comp) => {
        const adjustedPrice = Math.max(0, comp.salePrice + comp.adjustment);
        const ppsf = adjustedPrice / comp.sqft;
        const weight = 1 / (1 + Math.max(0, comp.distanceMiles));
        return { ...comp, adjustedPrice, ppsf, weight };
      });
    const weightTotal = valid.reduce((sum, comp) => sum + comp.weight, 0);
    const weightedPpsf = weightTotal > 0 ? valid.reduce((sum, comp) => sum + comp.ppsf * comp.weight, 0) / weightTotal : 0;
    const suggestedArv = subjectSqft > 0 && weightedPpsf > 0 ? Math.round(subjectSqft * weightedPpsf) : 0;
    const lowPpsf = valid.length ? Math.min(...valid.map((comp) => comp.ppsf)) : 0;
    const highPpsf = valid.length ? Math.max(...valid.map((comp) => comp.ppsf)) : 0;
    const low = subjectSqft > 0 && lowPpsf > 0 ? Math.round(subjectSqft * lowPpsf) : 0;
    const high = subjectSqft > 0 && highPpsf > 0 ? Math.round(subjectSqft * highPpsf) : 0;
    return { valid, weightedPpsf, suggestedArv, low, high, confidence: valid.length >= 3 && subjectSqft > 0 ? "medium" : "low" };
  }, [manualComps, subjectSqft]);

  const rehabTotal = useMemo(() => Object.values(rehabItems).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0), [rehabItems]);

  useEffect(() => {
    if (!selected?.parcel_id) return;
    try {
      const raw = localStorage.getItem(`firstlook-pipeline-${selected.parcel_id}`);
      if (!raw) {
        setPipelineStage("Researching");
        setPipelineNote("");
        return;
      }
      const parsed = JSON.parse(raw) as { stage?: string; note?: string };
      setPipelineStage(PIPELINE_STAGES.includes(parsed.stage as (typeof PIPELINE_STAGES)[number]) ? parsed.stage as (typeof PIPELINE_STAGES)[number] : "Researching");
      setPipelineNote(typeof parsed.note === "string" ? parsed.note : "");
    } catch {
      setPipelineStage("Researching");
      setPipelineNote("");
    }
  }, [selected?.parcel_id]);

  function savePipeline(stage: (typeof PIPELINE_STAGES)[number], note: string) {
    setPipelineStage(stage);
    setPipelineNote(note);
    if (selected?.parcel_id) localStorage.setItem(`firstlook-pipeline-${selected.parcel_id}`, JSON.stringify({ stage, note }));
  }

  const dealAnalysis = useMemo(() => {
    const d = dealInputs;
    const safePct = (n: number) => Math.max(0, Math.min(100, n)) / 100;
    const down = d.purchasePrice * safePct(d.downPaymentPct);
    const loan = Math.max(0, d.purchasePrice - down);
    const monthlyRate = Math.max(0, d.interestRate) / 100 / 12;
    const payments = Math.max(1, Math.round(Math.max(1, d.loanYears) * 12));
    const mortgage = loan <= 0 ? 0 : monthlyRate === 0 ? loan / payments : loan * monthlyRate * Math.pow(1 + monthlyRate, payments) / (Math.pow(1 + monthlyRate, payments) - 1);
    const vacancy = d.monthlyRent * safePct(d.vacancyPct);
    const management = d.monthlyRent * safePct(d.managementPct);
    const monthlyOperating = vacancy + management + d.taxesMonthly + d.insuranceMonthly + d.otherMonthly;
    const monthlyExpenses = mortgage + monthlyOperating;
    const cashFlow = d.monthlyRent - monthlyExpenses;
    const annualNoi = (d.monthlyRent - monthlyOperating) * 12;
    const annualDebtService = mortgage * 12;
    const dscr = annualDebtService > 0 ? annualNoi / annualDebtService : 0;
    const loanToValue = d.arv > 0 ? loan / d.arv : 0;
    const buyClosing = d.purchasePrice * safePct(d.buyClosingPct);
    const rehabContingency = d.rehab * safePct(d.contingencyPct);
    const holding = Math.max(0, d.holdingMonths) * Math.max(0, d.monthlyHolding);
    const riskReserves = d.titleLegal + d.survivingLiens + d.evictionPossession + d.auctionFees + d.redemptionCarry;
    const cashNeeded = down + buyClosing + d.rehab + rehabContingency + holding + riskReserves;
    const rentalBasis = d.purchasePrice + buyClosing + d.rehab + rehabContingency + riskReserves;
    const capRate = rentalBasis > 0 ? annualNoi / rentalBasis : 0;
    const cashOnCash = cashNeeded > 0 ? cashFlow * 12 / cashNeeded : 0;
    const sellClosing = d.arv * safePct(d.sellClosingPct);
    const flipProfit = d.arv - d.purchasePrice - buyClosing - d.rehab - rehabContingency - holding - sellClosing - riskReserves;
    const totalProjectCost = d.purchasePrice + buyClosing + d.rehab + rehabContingency + holding + sellClosing + riskReserves;
    const flipRoi = cashNeeded > 0 ? flipProfit / cashNeeded : 0;
    const targetProfit = d.arv * safePct(d.targetProfitPct);
    const beforeBuyClosing = d.arv - sellClosing - d.rehab - rehabContingency - holding - targetProfit - riskReserves;
    const mao = Math.max(0, beforeBuyClosing / (1 + safePct(d.buyClosingPct)));
    const refiGross = d.arv * safePct(d.refiLtvPct);
    const refiClosing = refiGross * safePct(d.refiClosingPct);
    const refiNet = Math.max(0, refiGross - refiClosing);
    const elapsedPayments = Math.min(payments, Math.max(0, Math.round(d.holdingMonths)));
    const remainingLoan = loan <= 0 ? 0 : monthlyRate === 0
      ? Math.max(0, loan - mortgage * elapsedPayments)
      : Math.max(0, loan * Math.pow(1 + monthlyRate, elapsedPayments) - mortgage * (Math.pow(1 + monthlyRate, elapsedPayments) - 1) / monthlyRate);
    const cashBackFromRefi = Math.max(0, refiNet - remainingLoan);
    const initialCashBasis = cashNeeded;
    const cashLeftIn = Math.max(0, initialCashBasis - cashBackFromRefi);
    const warnings = [
      d.arv <= 0 ? "Working ARV is missing." : null,
      d.monthlyRent <= 0 && dealStrategy !== "flip" ? "Monthly rent is missing; rental returns are not decision-ready." : null,
      d.taxesMonthly <= 0 && dealStrategy !== "flip" ? "Property tax assumption is missing." : null,
      d.insuranceMonthly <= 0 && dealStrategy !== "flip" ? "Insurance assumption is missing." : null,
      dealStrategy === "brrrr" && refiNet <= remainingLoan ? "Refinance proceeds do not exceed the estimated remaining acquisition loan, so no investor cash-out is modeled." : null,
      "Working ARV is an estimate until property-level sold comps are verified.",
    ].filter(Boolean) as string[];
    return { down, loan, mortgage, monthlyExpenses, cashFlow, annualNoi, annualDebtService, dscr, loanToValue, cashNeeded, rentalBasis, capRate, cashOnCash, flipProfit, flipRoi, totalProjectCost, targetProfit, riskReserves, mao, refiGross, refiClosing, refiNet, remainingLoan, cashBackFromRefi, cashLeftIn, buyClosing, sellClosing, rehabContingency, holding, warnings };
  }, [dealInputs, dealStrategy]);

  const investorIntel = useMemo(() => {
    const props = data?.properties ?? [];
    const diligenceTotal = diligence?.checklist.length ?? 0;
    const diligenceDone = Object.values(checkedItems).filter(Boolean).length;
    const missing: Array<{label:string; module:OsModule; why:string}> = [];
    if (dealStrategy !== "flip" && dealInputs.monthlyRent <= 0) missing.push({ label: "Add market rent", module: "analyzer", why: "Rental and BRRRR returns cannot be trusted without rent." });
    if (dealStrategy !== "flip" && dealInputs.taxesMonthly <= 0) missing.push({ label: "Verify property taxes", module: "diligence", why: "Taxes materially change NOI and cash flow." });
    if (dealStrategy !== "flip" && dealInputs.insuranceMonthly <= 0) missing.push({ label: "Add insurance quote", module: "analyzer", why: "Insurance is still an assumption." });
    missing.push({ label: "Verify sold comps / ARV", module: "comps", why: "Current ARV is modeled context, not property-level sold comps." });
    if (diligenceDone < diligenceTotal) missing.push({ label: `Finish diligence (${diligenceDone}/${diligenceTotal})`, module: "diligence", why: "Unchecked title, lien, occupancy or auction items can change the deal." });
    const look = props.filter(p=>p.lookAtFirst);
    const totalModeledValue = props.reduce((s,p)=>s+(p.estimatedMarketMid ?? p.assessed_fmv ?? 0),0);
    const totalCryOut = props.reduce((s,p)=>s+(p.cry_out_bid ?? 0),0);
    const flagged = props.filter(p=>p.redFlags.length>0).length;
    const selectedReadiness = Math.max(0, 100 - Math.min(100, missing.length * 16));
    return { missing, look, totalModeledValue, totalCryOut, flagged, selectedReadiness };
  }, [data, diligence, checkedItems, dealStrategy, dealInputs.monthlyRent, dealInputs.taxesMonthly, dealInputs.insuranceMonthly]);

  const liveBidPreview = useMemo(() => {
    if (!selected) return null;
    const arv = selected.estimatedMarketMid ?? selected.assessed_fmv;
    const b = normalizeBidDefaults(bidDefaults);
    return calculateMaxBid({
      arv,
      rehab: b.rehab,
      holdingMonths: b.holdingMonths,
      monthlyHolding: b.monthlyHolding,
      closingBuyPct: b.closingBuyPct / 100,
      closingSellPct: b.closingSellPct / 100,
      desiredProfit: Math.round(arv * (b.desiredProfitPct / 100)),
      contingency: Math.round(b.rehab * (b.contingencyPct / 100)),
      cryOutBid: selected.cry_out_bid,
      titleLegal: b.titleLegal,
      survivingLiens: b.survivingLiens,
      evictionPossession: b.evictionPossession,
      auctionFees: b.auctionFees,
      redemptionCarry: b.redemptionCarry,
    });
  }, [selected, bidDefaults]);

  async function runLiveResearch() {
    if (!csvText.trim()) {
      setError("Paste a tax-sale CSV first (or use the demo).");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus("Researching with your buy box… 1–3 minutes for larger lists");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvText,
          buyBox: normalizeBuyBox(buyBox),
          bidDefaults: bidPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      const scored = applyLocalRescore((json as ResearchResponse).properties, "live");
      applyResponse({ ...(json as ResearchResponse), ...scored });
      setStatus(`Live research complete · ${scored.total} parcels`);
      setFilter("look");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  function applyBuyBoxAndBids() {
    if (!data?.properties.length) {
      setError("Load demo or research a list first.");
      return;
    }
    setError(null);
    setStatus("Re-ranking with your buy box + bid settings…");
    try {
      const scored = applyLocalRescore(data.properties);
      applyResponse(scored, selected?.parcel_id);
      setStatus(
        `Applied · look-first ${scored.lookFirstCount} · top max bid ${money(scored.properties[0]?.maxBid)}`,
      );
      setFilter("look");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescore failed");
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setStatus(`Loaded ${file.name}`);
  }

  async function exportCsv(format: "full" | "bid-sheet" | "filtered" = "full") {
    if (!data?.properties.length) return;
    const properties =
      format === "filtered"
        ? filtered
        : format === "bid-sheet"
          ? data.properties.filter((p) => p.lookAtFirst || p.score >= 70)
          : data.properties;
    if (!properties.length) {
      setError("Nothing to export for this filter.");
      return;
    }
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties,
        format: format === "filtered" ? "full" : format,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      format === "bid-sheet"
        ? "firstlook-auction-bid-sheet.csv"
        : format === "filtered"
          ? "firstlook-filtered.csv"
          : "firstlook-look-first.csv";
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${properties.length} rows`);
  }

  async function registerWatch() {
    setWatchMsg(null);
    const res = await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: watchEmail,
        county: watchCounty,
        state: watchState,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? json.error ?? "Watch registration failed");
      return;
    }
    setWatchMsg(json.message);
  }

  function recalcMaxBid(property: ScoredProperty) {
    const arv = property.estimatedMarketMid ?? property.assessed_fmv;
    const b = normalizeBidDefaults(bidDefaults);
    const json = calculateMaxBid({
      arv,
      rehab: b.rehab,
      holdingMonths: b.holdingMonths,
      monthlyHolding: b.monthlyHolding,
      closingBuyPct: b.closingBuyPct / 100,
      closingSellPct: b.closingSellPct / 100,
      desiredProfit: Math.round(arv * (b.desiredProfitPct / 100)),
      contingency: Math.round(b.rehab * (b.contingencyPct / 100)),
      cryOutBid: property.cry_out_bid,
      titleLegal: b.titleLegal,
      survivingLiens: b.survivingLiens,
      evictionPossession: b.evictionPossession,
      auctionFees: b.auctionFees,
      redemptionCarry: b.redemptionCarry,
    });
    const bidUpdated: ScoredProperty = {
      ...property,
      maxBid: json.maxBid,
      projectedProfitAtMaxBid: json.projectedProfit,
    };
    const next: ScoredProperty = { ...bidUpdated, dealTruth: calculateDealTruthScore(bidUpdated) };
    setSelected(next);
    setData((prev) =>
      prev
        ? {
            ...prev,
            properties: prev.properties.map((p) =>
              p.parcel_id === property.parcel_id ? next : p,
            ),
          }
        : prev,
    );
    setStatus(`Max bid locked at ${money(json.maxBid)} for ${property.cleanAddress}`);
  }

  function openAiContext(e: React.MouseEvent, label: string, value: string) {
    e.preventDefault();
    setAiContextMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 100), label, value });
  }

  async function askConcierge(question = conciergeQuestion, forceEngineer = false) {
    if (!question.trim()) return;
    const engineerIntent = forceEngineer || /\b(fix|bug|wrong|incorrect|issue|broken|calculate|calculation|formula|algorithm|ui|overflow|cutting|audit)\b/i.test(question);
    const useEngineer = engineerIntent && !!engineerKey.trim();
    setConciergeOpen(true);
    setAiContextMenu(null);
    setConciergeMessages((m) => [...m, { role: "user", text: question }]);
    setConciergeQuestion("");
    setConciergeLoading(true);
    try {
      const res = await fetch(useEngineer ? "/api/admin/engineer" : "/api/concierge", {
        method: "POST",
        headers: useEngineer ? { "Content-Type": "application/json", "x-firstlook-admin-key": engineerKey } : { "Content-Type": "application/json" },
        body: JSON.stringify(useEngineer ? {
          request: question, module: osModule, strategy: dealStrategy, inputs: dealInputs, results: dealAnalysis, property: selected ?? undefined
        } : {
          question, history: conciergeMessages.slice(-8), property: selected ?? undefined, diligence,
          analysis: { module: osModule, strategy: dealStrategy, inputs: dealInputs, results: dealAnalysis },
          portfolio: { total: data?.total, lookFirstCount: data?.lookFirstCount },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Concierge failed");
      const engineerChecks = useEngineer && Array.isArray(json.deterministicFindings) && json.deterministicFindings.length ? "\n\nChecks:\n- " + json.deterministicFindings.join("\n- ") : "";
      const providerNote = !useEngineer && json.fallback ? `\n\nProvider status: ${json.providerReason ?? json.providerStatus ?? "fallback"}` : "";
      setConciergeMessages((m) => [...m, { role: "assistant", text: useEngineer ? ("⚙ Engineer mode\n\n" + (json.analysis ?? "Diagnosis complete.") + engineerChecks + "\n\nI will not silently deploy a code change; use the approved fix workflow for source changes.") : (json.answer + providerNote) }]);
    } catch (err) {
      setConciergeMessages((m) => [...m, { role: "assistant", text: err instanceof Error ? err.message : "Concierge is unavailable." }]);
    } finally {
      setConciergeLoading(false);
    }
  }


  useEffect(() => {
    conciergeScrollRef.current?.scrollTo({ top: conciergeScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conciergeMessages, conciergeLoading]);

  useEffect(() => {
    const close = () => setAiContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, []);

  function toggleCheck(id: string) {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.left}>
          <Link href="/" className={styles.brand}>
            FirstLook
          </Link>
          <span className="pill pill-mint">Bid discipline</span>
        </div>
        <div className={styles.actions}>
          <a className="btn btn-ghost" href="/api/export">
            CSV template
          </a>
          <button className="btn btn-ghost" onClick={() => void loadDemo()} disabled={loading}>
            Demo
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void exportCsv("bid-sheet")}
            disabled={!data || loading}
          >
            Bid sheet
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void exportCsv("filtered")}
            disabled={!data || !filtered.length || loading}
          >
            Export view
          </button>
          <button className="btn btn-primary" onClick={() => void exportCsv("full")} disabled={!data || loading}>
            Export all
          </button>
        </div>
      </header>

      <nav className={styles.osNav} aria-label="Real Estate OS modules">
        {([
          ["taxsale","Tax Sale"],["property360","Property 360"],["analyzer","Deal Analyzer"],["comps","Comps & ARV"],["rehab","Rehab"],["financing","Financing"],["diligence","Due Diligence"],["pipeline","Pipeline"],["portfolio","Portfolio"],
        ] as const).map(([key,label]) => (
          <button key={key} className={osModule === key ? styles.osNavActive : ""} onClick={() => setOsModule(key)}>{label}</button>
        ))}
      </nav>

      {osModule !== "taxsale" ? (
        <section className={styles.osWorkspace}>
          <div className={styles.osHero}>
            <div><span className="pill pill-mint">FirstLook Real Estate OS</span><h1>{osModule === "property360" ? "Property 360" : osModule === "analyzer" ? "AI Deal Analyzer" : ({ comps:"Comps & ARV", rehab:"Rehab Estimator", financing:"Financing Lab", diligence:"Due Diligence", pipeline:"Deal Pipeline", portfolio:"Portfolio" } as Record<string,string>)[osModule]}</h1>
            <p className="muted">{selected ? <><strong>{selected.cleanAddress}</strong> · APN {selected.parcel_id} · <span className={styles.contextTag}>Selected property</span></> : "Select a property from Tax Sale to start a complete investment analysis."}</p></div>
            <button className="btn btn-ghost" onClick={() => setOsModule("taxsale")}>← Tax Sale workspace</button>
          </div>
          {selected && (osModule === "property360" || osModule === "analyzer") ? (
            <>
              {osModule === "property360" ? <div className={styles.propertyBrief}><div><span className={styles.eyebrow}>Deal intelligence</span><h2>{investorIntel.selectedReadiness >= 70 ? "Analysis is progressing — verify the remaining evidence." : "This deal is not decision-ready yet."}</h2><p>{investorIntel.missing[0]?.why ?? "Core evidence is present. Review diligence before committing capital."}</p></div><div className={styles.briefActions}><button className="btn btn-primary" onClick={()=>setOsModule(investorIntel.missing[0]?.module ?? "diligence")}>Resolve next issue →</button><button className="btn btn-ghost" onClick={()=>void askConcierge("Create a Property 360 deal brief using only known evidence. Separate facts, estimates, assumptions, risks, and next verification steps.")}>✦ AI deal brief</button></div></div> : null}
              <div className={styles.strategyTabs}>{(["flip","rental","brrrr"] as DealStrategy[]).map(s => <button key={s} className={dealStrategy === s ? styles.osNavActive : ""} onClick={() => setDealStrategy(s)}>{s.toUpperCase()}</button>)}</div>
              <div className={styles.osMetrics}>
                <div onContextMenu={(e)=>openAiContext(e,"Purchase price",money(dealInputs.purchasePrice))}><span>Purchase</span><strong>{money(dealInputs.purchasePrice)}</strong></div>
                <div onContextMenu={(e)=>openAiContext(e,"Working ARV",money(dealInputs.arv))}><span>Working ARV <em className={styles.evidenceEstimate}>Estimate</em></span><strong>{money(dealInputs.arv)}</strong></div>
                <div onContextMenu={(e)=>openAiContext(e,"Rehab assumption",money(dealInputs.rehab))}><span>Rehab <em className={styles.evidenceAssumption}>Assumption</em></span><strong>{money(dealInputs.rehab)}</strong></div>
                {dealStrategy === "flip" ? <><div onContextMenu={(e)=>openAiContext(e,"Flip profit",money(dealAnalysis.flipProfit))}><span>Projected profit</span><strong>{money(dealAnalysis.flipProfit)}</strong></div><div><span>Investor MAO</span><strong>{money(dealAnalysis.mao)}</strong></div></> : <><div><span>Cash flow / mo</span><strong>{money(dealAnalysis.cashFlow)}</strong></div><div><span>Cash-on-cash</span><strong>{pct(dealAnalysis.cashOnCash)}</strong></div></>}
              </div>
              <div className={styles.analyzerGrid}>
                <div className="panel">
                  <h2>Deal assumptions</h2><div className={styles.trustNotice}><strong>Evidence-aware analysis</strong><span>Green = public-record input · amber = model estimate · blue = your assumption. Verify comps, rent, taxes, insurance, condition and title before committing capital.</span></div>
                  <div className={styles.inputGrid}>
                    {([["purchasePrice","Purchase price"],["arv","Working ARV"],["rehab","Base rehab"],["monthlyRent","Monthly rent"],["downPaymentPct","Down payment %"],["interestRate","Interest rate %"],["loanYears","Loan years"],["vacancyPct","Vacancy %"],["managementPct","Management %"],["taxesMonthly","Taxes / mo"],["insuranceMonthly","Insurance / mo"],["otherMonthly","Other / mo"],["buyClosingPct","Buy closing %"],["sellClosingPct","Sell/disposition %"],["holdingMonths","Holding months"],["monthlyHolding","Holding cost / mo"],["contingencyPct","Rehab contingency %"],["targetProfitPct","Target profit % of ARV"],["refiLtvPct","Refi LTV %"],["refiClosingPct","Refi closing %"]] as const).map(([key,label]) => <label key={key}><span>{label}{key === "arv" ? <em className={styles.evidenceEstimate}>Estimate</em> : key === "purchasePrice" ? <em className={styles.evidencePublic}>Public record</em> : <em className={styles.evidenceAssumption}>Assumption</em>}</span><input min="0" type="number" step="any" value={dealInputs[key]} onChange={(e)=>setDealInputs(v=>({...v,[key]:normalizeDealInput(key,Number(e.target.value))}))}/></label>)}
                  </div>
                  <details className={styles.advancedBox}>
                    <summary>Tax-sale / legal risk reserves</summary>
                    <p className="muted">Keep these at zero only when you intentionally have no reserve. They affect cash required, flip profit, cap rate basis and MAO.</p>
                    <div className={styles.inputGrid}>
                      {([["titleLegal","Title / legal reserve"],["survivingLiens","Potential surviving liens"],["evictionPossession","Possession / eviction"],["auctionFees","Auction / deed fees"],["redemptionCarry","Redemption carry"]] as const).map(([key,label])=><label key={key}><span>{label}<em className={styles.evidenceAssumption}>Assumption</em></span><input min="0" type="number" value={dealInputs[key]} onChange={(e)=>setDealInputs(v=>({...v,[key]:normalizeDealInput(key,Number(e.target.value))}))}/></label>)}
                    </div>
                  </details>
                </div>
                <div className="panel">
                  <h2>{dealStrategy === "flip" ? "Flip outcome" : dealStrategy === "rental" ? "Rental outcome" : "BRRRR outcome"}</h2>
                  <div className={styles.outcomeList}>{dealAnalysis.warnings.length ? <div className={styles.analysisWarnings}>{dealAnalysis.warnings.map(w=><p key={w}>⚠ {w}</p>)}</div> : null}
                    {dealStrategy === "flip" ? <><p><span>Projected profit</span><strong>{money(dealAnalysis.flipProfit)}</strong></p><p><span>Investor MAO</span><strong>{money(dealAnalysis.mao)}</strong></p><p><span>Total project cost</span><strong>{money(dealAnalysis.totalProjectCost)}</strong></p><p><span>Risk reserves</span><strong>{money(dealAnalysis.riskReserves)}</strong></p><p><span>Target profit ({dealInputs.targetProfitPct}%)</span><strong>{money(dealAnalysis.targetProfit)}</strong></p><p><span>Cash required</span><strong>{money(dealAnalysis.cashNeeded)}</strong></p><p><span>ROI on modeled cash</span><strong>{pct(dealAnalysis.flipRoi)}</strong></p></> : <><p><span>Mortgage</span><strong>{money(dealAnalysis.mortgage)}/mo</strong></p><p><span>Cash flow</span><strong>{money(dealAnalysis.cashFlow)}/mo</strong></p><p><span>NOI</span><strong>{money(dealAnalysis.annualNoi)}/yr</strong></p><p><span>All-in basis for cap rate</span><strong>{money(dealAnalysis.rentalBasis)}</strong></p><p><span>Cap rate</span><strong>{pct(dealAnalysis.capRate)}</strong></p><p><span>Cash-on-cash</span><strong>{pct(dealAnalysis.cashOnCash)}</strong></p><p><span>DSCR</span><strong>{dealAnalysis.dscr > 0 ? dealAnalysis.dscr.toFixed(2) : "—"}</strong></p>{dealStrategy === "brrrr" ? <><p><span>Gross refinance ({dealInputs.refiLtvPct}% LTV)</span><strong>{money(dealAnalysis.refiGross)}</strong></p><p><span>Estimated loan payoff</span><strong>{money(dealAnalysis.remainingLoan)}</strong></p><p><span>Cash back after payoff</span><strong>{money(dealAnalysis.cashBackFromRefi)}</strong></p><p><span>Cash left in deal</span><strong>{money(dealAnalysis.cashLeftIn)}</strong></p></> : null}</>}
                  </div>
                  <button className="btn btn-primary" onClick={()=>void askConcierge(`Analyze this ${dealStrategy} scenario. Purchase ${money(dealInputs.purchasePrice)}, ARV ${money(dealInputs.arv)}, rehab ${money(dealInputs.rehab)}, rent ${money(dealInputs.monthlyRent)}. Explain strengths, risks, and which assumptions I should verify.`)}>✦ Ask AI to analyze this deal</button>
                </div>
              </div>
            </>
          ) : selected ? (
            <div className={styles.moduleGrid}>
              {osModule === "comps" && <>
                <div className="panel">
                  <h2>Valuation evidence</h2>
                  <div className={styles.moduleMetrics}>
                    <p><span>Assessed FMV</span><strong>{money(selected.assessed_fmv)}</strong><em className={styles.evidencePublic}>Public record</em></p>
                    <p><span>Modeled context</span><strong>{money(selected.estimatedMarketMid)}</strong><em className={styles.evidenceEstimate}>Estimate</em></p>
                    <p><span>ACS tract median</span><strong>{money(selected.tractMedianHomeValue)}</strong><em className={styles.evidencePublic}>Neighborhood</em></p>
                    <p><span>Working ARV</span><strong>{money(dealInputs.arv)}</strong><em className={styles.evidenceEstimate}>Unverified</em></p>
                  </div>
                  <div className="field"><label>Subject living area (sq ft)</label><input type="number" min="0" value={subjectSqft} onChange={(e)=>setSubjectSqft(Math.max(0,Number(e.target.value)||0))}/></div>
                  <p className="muted">Enter real sold comps below. FirstLook weights closer comps more heavily, but manual entries are still user-supplied evidence until source documents are attached.</p>
                </div>
                <div className="panel">
                  <h2>Manual sold comps</h2>
                  <div className={styles.compRows}>
                    {manualComps.map((comp,index)=>{
                      const calc=compAnalysis.valid.find((v)=>v.id===comp.id);
                      return <div className={styles.compRow} key={comp.id}>
                        <strong>Comp {index+1}</strong>
                        <input aria-label={`Comp ${index+1} address`} placeholder="Address / source note" value={comp.address} onChange={(e)=>setManualComps(rows=>rows.map(row=>row.id===comp.id?{...row,address:e.target.value}:row))}/>
                        <input aria-label={`Comp ${index+1} sale price`} type="number" min="0" placeholder="Sale price" value={comp.salePrice||""} onChange={(e)=>setManualComps(rows=>rows.map(row=>row.id===comp.id?{...row,salePrice:Math.max(0,Number(e.target.value)||0)}:row))}/>
                        <input aria-label={`Comp ${index+1} sqft`} type="number" min="0" placeholder="Sq ft" value={comp.sqft||""} onChange={(e)=>setManualComps(rows=>rows.map(row=>row.id===comp.id?{...row,sqft:Math.max(0,Number(e.target.value)||0)}:row))}/>
                        <input aria-label={`Comp ${index+1} distance`} type="number" min="0" step="0.1" placeholder="Miles" value={comp.distanceMiles||""} onChange={(e)=>setManualComps(rows=>rows.map(row=>row.id===comp.id?{...row,distanceMiles:Math.max(0,Number(e.target.value)||0)}:row))}/>
                        <input aria-label={`Comp ${index+1} adjustment`} type="number" step="100" placeholder="Adjustment +/- $" value={comp.adjustment||""} onChange={(e)=>setManualComps(rows=>rows.map(row=>row.id===comp.id?{...row,adjustment:Number(e.target.value)||0}:row))}/>
                        <span className="mono">{calc ? `${Math.round(calc.ppsf).toLocaleString()}/sf` : "—/sf"}</span>
                      </div>;
                    })}
                  </div>
                  <div className={styles.moduleMetrics}>
                    <p><span>Valid comps</span><strong>{compAnalysis.valid.length}/3</strong></p>
                    <p><span>Weighted $/sf</span><strong>{compAnalysis.weightedPpsf ? `${Math.round(compAnalysis.weightedPpsf).toLocaleString()}` : "—"}</strong></p>
                    <p><span>Comp ARV range</span><strong>{compAnalysis.low ? `${money(compAnalysis.low)}–${money(compAnalysis.high)}` : "—"}</strong></p>
                    <p><span>Suggested ARV</span><strong>{money(compAnalysis.suggestedArv)}</strong><em className={styles.evidenceAssumption}>{compAnalysis.confidence} confidence</em></p>
                  </div>
                  <div className={styles.moduleActions}>
                    <button className="btn btn-primary" disabled={!compAnalysis.suggestedArv} onClick={()=>setDealInputs(v=>({...v,arv:compAnalysis.suggestedArv}))}>Use comp ARV in analyzer</button>
                    <button className="btn btn-ghost" onClick={()=>void askConcierge(`Review my manual comp set: subject ${subjectSqft} sqft, weighted price per sqft ${Math.round(compAnalysis.weightedPpsf)}, suggested ARV ${compAnalysis.suggestedArv}. Tell me what makes these comps weak or strong and what evidence is still missing.`)}>✦ Audit comps</button>
                  </div>
                </div>
              </>}
              {osModule === "rehab" && <>
                <div className="panel">
                  <h2>Itemized rehab estimator</h2>
                  <div className={styles.rehabGrid}>
                    {(Object.entries(REHAB_LABELS) as Array<[RehabKey,string]>).map(([key,label])=><label key={key}><span>{label}</span><input type="number" min="0" value={rehabItems[key]} onChange={(e)=>setRehabItems(items=>({...items,[key]:Math.max(0,Number(e.target.value)||0)}))}/></label>)}
                  </div>
                  <p className="muted">Use contractor quotes when available. This estimator is an assumption workspace, not a condition inspection.</p>
                </div>
                <div className="panel">
                  <h2>Rehab budget summary</h2>
                  <div className={styles.moduleMetrics}>
                    <p><span>Itemized base</span><strong>{money(rehabTotal)}</strong></p>
                    <p><span>Contingency ({dealInputs.contingencyPct}%)</span><strong>{money(rehabTotal*(dealInputs.contingencyPct/100))}</strong></p>
                    <p><span>All-in rehab reserve</span><strong>{money(rehabTotal*(1+dealInputs.contingencyPct/100))}</strong></p>
                    <p><span>Analyzer base rehab</span><strong>{money(dealInputs.rehab)}</strong></p>
                  </div>
                  <div className={styles.moduleActions}>
                    <button className="btn btn-primary" onClick={()=>setDealInputs(v=>({...v,rehab:rehabTotal}))}>Apply itemized base to analyzer</button>
                    <button className="btn btn-ghost" onClick={()=>void askConcierge(`Audit this rehab assumption: base rehab ${money(rehabTotal)}, contingency ${dealInputs.contingencyPct}%, property ${selected.cleanAddress}. Identify missing scopes and risk areas without inventing condition facts.`)}>✦ Audit rehab budget</button>
                  </div>
                </div>
              </>}
              {osModule === "financing" && <>
                <div className="panel">
                  <h2>Financing assumptions</h2>
                  <div className={styles.rehabGrid}>
                    {([["downPaymentPct","Down payment %"],["interestRate","Interest rate %"],["loanYears","Loan term (years)"],["taxesMonthly","Taxes / mo"],["insuranceMonthly","Insurance / mo"],["otherMonthly","Other operating / mo"]] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="number" min="0" value={dealInputs[key]} onChange={(e)=>setDealInputs(v=>({...v,[key]:normalizeDealInput(key,Number(e.target.value))}))}/></label>)}
                  </div>
                  <p className="muted">Financing outputs use standard amortization. Taxes, insurance and rent remain assumptions until verified.</p>
                </div>
                <div className="panel">
                  <h2>Debt + coverage</h2>
                  <div className={styles.moduleMetrics}>
                    <p><span>Loan amount</span><strong>{money(dealAnalysis.loan)}</strong></p>
                    <p><span>Down payment</span><strong>{money(dealAnalysis.down)}</strong></p>
                    <p><span>Monthly P&I</span><strong>{money(dealAnalysis.mortgage)}</strong></p>
                    <p><span>Loan / working ARV</span><strong>{pct(dealAnalysis.loanToValue)}</strong></p>
                    <p><span>Annual debt service</span><strong>{money(dealAnalysis.annualDebtService)}</strong></p>
                    <p><span>DSCR</span><strong>{dealAnalysis.dscr>0?dealAnalysis.dscr.toFixed(2):"—"}</strong></p>
                  </div>
                  {dealInputs.monthlyRent<=0?<p className={styles.inlineWarning}>Add verified market rent before treating DSCR or cash flow as decision-ready.</p>:null}
                  <div className={styles.moduleActions}><button className="btn btn-primary" onClick={()=>setOsModule("analyzer")}>Open full analyzer</button><button className="btn btn-ghost" onClick={()=>void askConcierge("Audit the current financing assumptions, debt service, LTV, DSCR and cash flow. Separate missing assumptions from actual formula risks.")}>✦ Audit financing</button></div>
                </div>
              </>}
              {osModule === "diligence" && <>
                <div className="panel">
                  <h2>Diligence status</h2>
                  <div className={styles.moduleMetrics}>
                    <p><span>Checks complete</span><strong>{Object.values(checkedItems).filter(Boolean).length}/{diligence?.checklist.length ?? 0}</strong></p>
                    <p><span>Jurisdiction rules</span><strong>{diligence?.rules.label ?? "Loading…"}</strong></p>
                    <p><span>Valuation confidence</span><strong>{diligence?.valuation.label ?? "—"}</strong></p>
                    <p><span>Overbid risk</span><strong>{diligence?.overbid.level ?? "—"}</strong></p>
                  </div>
                  <p className="muted">{diligence?.valuation.detail}</p>
                  <button className="btn btn-primary" onClick={()=>void askConcierge("Review the current diligence checklist and tell me what remains unverified, which items are highest consequence, and why they matter.")}>✦ Review with AI</button>
                </div>
                <div className="panel">
                  <h2>Verification checklist</h2>
                  <div className={styles.diligenceList}>{diligence?.checklist.map(item=><label key={item.id} className={styles.diligenceRow}><input type="checkbox" checked={!!checkedItems[item.id]} onChange={()=>toggleCheck(item.id)}/><span><strong>{item.label}</strong>{item.autoHint?<small>{item.autoHint}</small>:null}</span><em>{item.severity}</em></label>)}</div>
                </div>
              </>}
              {osModule === "pipeline" && <>
                <div className="panel">
                  <h2>Deal pipeline</h2>
                  <p className="muted">Stage is saved per parcel in this browser until account persistence is connected.</p>
                  <div className={styles.pipelineStages}>{PIPELINE_STAGES.map((stage)=><button key={stage} className={pipelineStage===stage?styles.stageActive:""} onClick={()=>savePipeline(stage,pipelineNote)}>{stage}</button>)}</div>
                  <div className={styles.moduleMetrics}><p><span>Current stage</span><strong>{pipelineStage}</strong></p><p><span>Deal</span><strong>{selected.cleanAddress}</strong></p></div>
                </div>
                <div className="panel">
                  <h2>Next-action note</h2>
                  <textarea className={styles.pipelineNote} rows={7} value={pipelineNote} onChange={(e)=>savePipeline(pipelineStage,e.target.value)} placeholder="Example: Order title search, verify occupancy, call county about payment window…"/>
                  <div className={styles.moduleActions}><button className="btn btn-primary" onClick={()=>void askConcierge(`Pipeline stage: ${pipelineStage}. Note: ${pipelineNote || "none"}. Based only on current FirstLook evidence, give me the next three actions for this deal.`)}>✦ Suggest next actions</button></div>
                </div>
              </>}
              {osModule === "portfolio" && <div className={styles.commandCenter}>
                <div className={styles.commandHero}>
                  <div><span className="pill pill-mint">Investor Command Center</span><h2>Know what deserves attention now.</h2><p className="muted">Research pipeline intelligence — not acquired-asset accounting. Portfolio ownership metrics activate when persistent acquired assets are connected.</p></div>
                  <button className="btn btn-primary" onClick={()=>void askConcierge("Give me a concise command-center brief: what deserves attention first, what evidence is missing, and what should I verify next?")}>✦ Generate investor brief</button>
                </div>
                <div className={styles.commandMetrics}>
                  <div><span>Research pipeline</span><strong>{data?.total ?? 0}</strong><small>candidate properties</small></div>
                  <div><span>Look first</span><strong>{data?.lookFirstCount ?? 0}</strong><small>prioritized by current buy box</small></div>
                  <div><span>Flagged</span><strong>{investorIntel.flagged}</strong><small>need closer review</small></div>
                  <div><span>Modeled value</span><strong>{money(investorIntel.totalModeledValue)}</strong><small>estimate, not owned equity</small></div>
                  <div><span>Cry-out exposure</span><strong>{money(investorIntel.totalCryOut)}</strong><small>starting bids across pipeline</small></div>
                </div>
                <div className={styles.commandGrid}>
                  <section className="panel"><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Selected deal</span><h3>{selected?.cleanAddress}</h3></div><strong className={styles.readiness}>{investorIntel.selectedReadiness}% ready</strong></div>
                    <div className={styles.dealPulse}><div><span>Deal Truth</span><strong>{selected?.dealTruth?.overall ?? "—"}</strong></div><div><span>Max bid</span><strong>{money(selected?.maxBid)}</strong></div><div><span>Working ARV</span><strong>{money(dealInputs.arv)}</strong></div><div><span>Red flags</span><strong>{selected?.redFlags.length ?? 0}</strong></div></div>
                    <div className={styles.commandActions}><button className="btn btn-primary" onClick={()=>setOsModule("property360")}>Open Property 360</button><button className="btn btn-ghost" onClick={()=>setOsModule("analyzer")}>Run scenarios</button><button className="btn btn-ghost" onClick={()=>setOsModule("diligence")}>Verify deal</button></div>
                  </section>
                  <section className="panel"><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Action center</span><h3>What needs attention</h3></div><span className="pill">{investorIntel.missing.length} open</span></div>
                    <div className={styles.actionList}>{investorIntel.missing.slice(0,5).map(item=><button key={item.label} onClick={()=>setOsModule(item.module)}><span><strong>{item.label}</strong><small>{item.why}</small></span><b>→</b></button>)}</div>
                  </section>
                  <section className={"panel "+styles.spanTwo}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Opportunity queue</span><h3>Deals to review first</h3></div><button className="btn btn-ghost" onClick={()=>setOsModule("taxsale")}>View all</button></div>
                    <div className={styles.dealQueue}>{investorIntel.look.slice(0,5).map(p=><button key={p.parcel_id} onClick={()=>{setSelected(p);setOsModule("property360")}}><span className={styles.queueRank}>#{p.rank}</span><span className={styles.queueAddress}><strong>{p.cleanAddress}</strong><small>{p.propertyType} · {p.redFlags.length} flags</small></span><span><small>Truth</small><strong>{p.dealTruth?.overall ?? "—"}</strong></span><span><small>Max bid</small><strong>{money(p.maxBid)}</strong></span><b>→</b></button>)}</div>
                  </section>
                </div>
              </div>}
            </div>
          ) : <div className="panel"><h2>No property selected</h2><p className="muted">Open Tax Sale, select a property, then return to this module.</p><button className="btn btn-primary" onClick={()=>setOsModule("taxsale")}>Open Tax Sale</button></div>}
        </section>
      ) : null}

      {osModule === "taxsale" ? <div className={styles.layout}>
        <aside className={`panel ${styles.sidebar}`}>
          <div className={styles.tabRow}>
            {(
              [
                ["research", "Research"],
                ["buybox", "Buy box"],
                ["bid", "Max bid"],
                ["watch", "Watch"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`btn ${sideTab === key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSideTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {sideTab === "research" ? (
            <>
              <h2>Run research</h2>
              <p className="muted">Drop the county&apos;s own list — up to 100 parcels per run.</p>

              <label className={styles.dropZone}>
                <span>Drop CSV here or browse</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="field">
                <label>Or paste CSV</label>
                <textarea
                  rows={7}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="parcel_id,owner,address,assessed_fmv,cry_out_bid,tax_years,county,state"
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={() => void runLiveResearch()}
                disabled={loading}
              >
                {loading ? "Working…" : "Research my list"}
              </button>
            </>
          ) : null}

          {sideTab === "buybox" ? (
            <>
              <h2>Your buy box</h2>
              <p className="muted">Control what qualifies for Look First. Hard limits filter deals; weights only change ranking.</p>

              <div className={styles.sidebarGrid}>
                <div className="field">
                  <label>Min assessed value ($)</label>
                  <input type="number" min="0" value={buyBox.minAssessedValue}
                    onChange={(e) => setBuyBox((b) => ({ ...b, minAssessedValue: Math.max(0, Number(e.target.value) || 0) }))} />
                </div>
                <div className="field">
                  <label>Max cry-out ($) · 0 = no cap</label>
                  <input type="number" min="0" value={buyBox.maxCryOutBid}
                    onChange={(e) => setBuyBox((b) => ({ ...b, maxCryOutBid: Math.max(0, Number(e.target.value) || 0) }))} />
                </div>
                <div className="field">
                  <label>Min equity spread %</label>
                  <input type="number" min="-100" max="100" step="1" value={Math.round(buyBox.minEquitySpread * 100)}
                    onChange={(e) => setBuyBox((b) => ({ ...b, minEquitySpread: Math.max(-1, Math.min(1, (Number(e.target.value) || 0) / 100)) }))} />
                </div>
                <div className="field">
                  <label>Target equity spread %</label>
                  <input type="number" min="1" max="100" step="1" value={Math.round(buyBox.targetEquitySpreadMin * 100)}
                    onChange={(e) => setBuyBox((b) => ({ ...b, targetEquitySpreadMin: Math.max(0.01, Math.min(1, (Number(e.target.value) || 1) / 100)) }))} />
                </div>
                <div className="field">
                  <label>Min Look First score</label>
                  <input type="number" min="0" max="100" value={buyBox.minLookFirstScore}
                    onChange={(e) => setBuyBox((b) => ({ ...b, minLookFirstScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
                </div>
                <div className="field">
                  <label>Max Look First deals</label>
                  <input type="number" min="1" max="25" value={buyBox.maxLookFirst}
                    onChange={(e) => setBuyBox((b) => ({ ...b, maxLookFirst: Math.max(1, Math.min(25, Math.round(Number(e.target.value) || 1))) }))} />
                </div>
                <div className="field">
                  <label>Max cry-out / assessed FMV %</label>
                  <input type="number" min="0.1" max="100" step="0.1" value={Math.round(buyBox.maxTaxBurdenRatio * 1000) / 10}
                    onChange={(e) => setBuyBox((b) => ({ ...b, maxTaxBurdenRatio: Math.max(0.001, Math.min(1, (Number(e.target.value) || 0.1) / 100)) }))} />
                </div>
              </div>

              <label className={styles.check}><input type="checkbox" checked={buyBox.preferResidential}
                onChange={(e) => setBuyBox((b) => ({ ...b, preferResidential: e.target.checked }))} />Prefer residential</label>
              <label className={styles.check}><input type="checkbox" checked={buyBox.avoidVacantLand}
                onChange={(e) => setBuyBox((b) => ({ ...b, avoidVacantLand: e.target.checked }))} />Avoid vacant / low-value land</label>
              <label className={styles.check}><input type="checkbox" checked={buyBox.avoidLlcInvestorOwned}
                onChange={(e) => setBuyBox((b) => ({ ...b, avoidLlcInvestorOwned: e.target.checked }))} />Soft-penalize LLC / investor owners</label>

              <details className={styles.advancedBox}>
                <summary>Advanced scoring + red-flag controls</summary>
                <div className={styles.sidebarGrid}>
                  <div className="field"><label>Low-value flag below ($)</label><input type="number" min="0" value={buyBox.redFlags.lowAssessedValue}
                    onChange={(e)=>setBuyBox((b)=>({...b,redFlags:{...b.redFlags,lowAssessedValue:Math.max(0,Number(e.target.value)||0)}}))}/></div>
                  <div className="field"><label>High cry-out/FMV flag %</label><input type="number" min="0" max="100" step="0.1" value={Math.round(buyBox.redFlags.highTaxBurdenRatio*1000)/10}
                    onChange={(e)=>setBuyBox((b)=>({...b,redFlags:{...b.redFlags,highTaxBurdenRatio:Math.max(0,Math.min(1,(Number(e.target.value)||0)/100))}}))}/></div>
                  <div className="field"><label>Long delinquency flag (years)</label><input type="number" min="1" max="50" value={buyBox.redFlags.longDelinquencyYears}
                    onChange={(e)=>setBuyBox((b)=>({...b,redFlags:{...b.redFlags,longDelinquencyYears:Math.max(1,Math.min(50,Math.round(Number(e.target.value)||1)))}}))}/></div>
                  {([
                    ["equitySpread","Equity spread weight"],
                    ["taxBurden","Cry-out/FMV weight"],
                    ["delinquencyYears","Delinquency weight"],
                    ["propertyType","Property type weight"],
                    ["neighborhoodValue","Neighborhood context weight"],
                  ] as const).map(([key,label])=><div className="field" key={key}><label>{label}</label><input type="number" min="0" max="100" value={buyBox.weights[key]}
                    onChange={(e)=>setBuyBox((b)=>({...b,weights:{...b.weights,[key]:Math.max(0,Math.min(100,Number(e.target.value)||0))}}))}/></div>)}
                </div>
              </details>

              <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => applyBuyBoxAndBids()} disabled={!data}>Apply buy box to list</button>
            </>
          ) : null}

          {sideTab === "bid" ? (
            <>
              <h2>Max bid settings</h2>
              <p className="muted">Build a hard ceiling from rehab, carrying, transaction, legal and tax-sale risk costs.</p>
              <div className={styles.sidebarGrid}>
                {([
                  ["rehab","Default rehab ($)",1],
                  ["holdingMonths","Holding months",1],
                  ["monthlyHolding","Monthly holding ($)",1],
                  ["desiredProfitPct","Desired profit % of ARV",0.5],
                  ["closingBuyPct","Buy closing %",0.1],
                  ["closingSellPct","Sell closing %",0.1],
                  ["contingencyPct","Rehab contingency %",0.5],
                  ["titleLegal","Title / legal reserve ($)",1],
                  ["survivingLiens","Potential surviving liens ($)",1],
                  ["evictionPossession","Possession / eviction reserve ($)",1],
                  ["auctionFees","Auction / deed fees ($)",1],
                  ["redemptionCarry","Redemption carry reserve ($)",1],
                ] as const).map(([key,label,step]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <input type="number" min="0" step={step} value={bidDefaults[key]}
                      onChange={(e)=>setBidDefaults((b)=>normalizeBidDefaults({...b,[key]:Number(e.target.value)||0}))}/>
                  </div>
                ))}
              </div>
              {liveBidPreview && selected ? (
                <div className={styles.bidPreview}>
                  <span className="muted">Live preview · {selected.cleanAddress}</span>
                  <strong className="mono">{money(liveBidPreview.maxBid)}</strong>
                  <span className="muted">Profit at ceiling ≈ {money(liveBidPreview.projectedProfit)}</span>
                  <span className="muted">Risk reserves included ≈ {money(bidDefaults.titleLegal + bidDefaults.survivingLiens + bidDefaults.evictionPossession + bidDefaults.auctionFees + bidDefaults.redemptionCarry)}</span>
                </div>
              ) : null}
              <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => applyBuyBoxAndBids()} disabled={!data}>Apply max bids to whole list</button>
            </>
          ) : null}

          {sideTab === "watch" ? (
            <>
              <h2>County watch</h2>
              <p className="muted">
                Save a county watch registration. Delivery is only active after the database and alert worker are connected; FirstLook will not pretend an alert is live before then.
              </p>
              <div className="field">
                <label>Email</label>
                <input value={watchEmail} onChange={(e) => setWatchEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>County</label>
                <input value={watchCounty} onChange={(e) => setWatchCounty(e.target.value)} />
              </div>
              <div className="field">
                <label>State</label>
                <input value={watchState} onChange={(e) => setWatchState(e.target.value)} />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => void registerWatch()}
              >
                Register watch
              </button>
              {watchMsg ? <p className={styles.status}>{watchMsg}</p> : null}
            </>
          ) : null}

          <p className={`${styles.status} muted`}>{status}</p>
          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.hint}>
            <strong>What this kills</strong>
            <span className="muted">
              Blind list research, adrenaline overbids, and missing county rules before you raise a
              paddle.
            </span>
          </div>
        </aside>

        <section className={styles.main}>
          {data ? (
            <>
              {impact ? (
                <div className={`panel ${styles.impact}`}>
                  <span className="pill pill-mint">{impact.problemSolvedPct}% noise cut</span>
                  <h2>{impact.headline}</h2>
                  <p className="muted">
                    That is the half of tax-sale work that usually wastes your week — deciding what
                    not to chase.
                  </p>
                </div>
              ) : null}

              <div className={styles.summary}>
                <div className="panel" onContextMenu={(e) => openAiContext(e, "Parcels in", String(data.total))} title="Right-click to ask AI">
                  <span className="muted">Parcels in</span>
                  <strong className="mono">{data.total}</strong>
                </div>
                <div className="panel" onContextMenu={(e) => openAiContext(e, "Look first", String(data.lookFirstCount))} title="Right-click to ask AI">
                  <span className="muted">Look first</span>
                  <strong className="mono">{data.lookFirstCount}</strong>
                </div>
                <div className="panel">
                  <span className="muted">Can skip</span>
                  <strong className="mono">{impact?.skipped ?? "—"}</strong>
                </div>
                <div className="panel">
                  <span className="muted">Hrs saved</span>
                  <strong className="mono">~{impact?.hoursSaved ?? "—"}</strong>
                </div>
              </div>

              {impact ? (
                <div className={styles.chartGrid}>
                  <FunnelChart
                    total={impact.total}
                    lookFirst={impact.lookFirst}
                    skipped={impact.skipped}
                    flagged={impact.flagged}
                  />
                  <ScoreBars properties={data.properties} />
                  {selected ? (
                    <BidGauge
                      cryOut={selected.cry_out_bid}
                      maxBid={selected.maxBid}
                      address={selected.cleanAddress}
                    />
                  ) : null}
                  {scoreSpark.length ? <SparkBars values={scoreSpark} label="Rank pulse" /> : null}
                </div>
              ) : null}

              <div className={styles.filterBar}>
                <div className={styles.filterRow}>
                  {(
                    [
                      ["all", `All (${filterCounts.all})`],
                      ["look", `Look first (${filterCounts.look})`],
                      ["flagged", `Flags (${filterCounts.flagged})`],
                      ["clean", `Clean (${filterCounts.clean})`],
                      ["headroom", `Bid OK (${filterCounts.headroom})`],
                      ["overbid", `Walk (${filterCounts.overbid})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`btn ${filter === key ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.filterTools}>
                  <div className="field">
                    <label>Search</label>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Address, owner, APN…"
                    />
                  </div>
                  <div className="field">
                    <label>Min score</label>
                    <input
                      type="number"
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="field">
                    <label>Sort</label>
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                    >
                      <option value="rank">Rank</option>
                      <option value="score">Score</option>
                      <option value="maxBid">Max bid</option>
                      <option value="cryOut">Cry-out</option>
                      <option value="spread">Equity spread</option>
                    </select>
                  </div>
                </div>
                <p className={`${styles.filterMeta} muted`}>
                  Showing {filtered.length} of {data.total}
                </p>
              </div>

              <div className={`table-wrap ${styles.tablePanel}`}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Score</th>
                      <th>Truth</th>
                      <th>Address</th>
                      <th>Cry-out</th>
                      <th>FMV</th>
                      <th>Max bid</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.parcel_id + p.rank}
                        className={p.lookAtFirst ? "look-first" : undefined}
                        onClick={() => setSelected(p)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="mono">
                          #{p.rank}
                          {p.lookAtFirst ? <div className="pill pill-mint">First</div> : null}
                        </td>
                        <td className="mono">{p.score}</td>
                        <td className="mono">{p.dealTruth?.overall ?? "—"}</td>
                        <td>
                          <div>{p.cleanAddress}</div>
                          <div className="muted" style={{ fontSize: "0.8rem" }}>
                            {p.owner}
                          </div>
                        </td>
                        <td className="mono">{money(p.cry_out_bid)}</td>
                        <td className="mono">{money(p.assessed_fmv)}</td>
                        <td className="mono">{money(p.maxBid)}</td>
                        <td>
                          {p.redFlags.length ? (
                            <span className="pill pill-warn">{p.redFlags.length}</span>
                          ) : (
                            <span className="pill pill-fog">Clean</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={`panel ${styles.empty}`}>
              {loading ? (
                <>
                  <p className={styles.loadingPulse}>
                    <span className="chart-live">
                      <i />
                    </span>{" "}
                    Scoring Clayton parcels…
                  </p>
                  <WorkflowDiagram />
                </>
              ) : (
                <>
                  <h2>See the cut before you chase a single drive-by</h2>
                  <WorkflowDiagram />
                  <button className="btn btn-primary" onClick={() => void loadDemo()}>
                    Load Clayton demo
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        <aside className={`panel ${styles.detail}`}>
          {selected ? (
            <>
              <div className={styles.detailHead}>
                <div>
                  <span className="pill pill-mint">#{selected.rank}</span>
                  {selected.lookAtFirst ? <span className="pill pill-mint">Look first</span> : null}
                </div>
                <h2>{selected.cleanAddress}</h2>
                <p className="muted">{selected.matchedAddress ?? selected.owner}</p>
              </div>

              {selected.dealTruth ? (
                <div className={styles.rulesBox} onContextMenu={(e) => openAiContext(e, "Deal Truth score", `${selected.dealTruth?.overall ?? "unknown"}/100`)} title="Right-click to ask AI">
                  <strong>Deal Truth {selected.dealTruth.overall}/100 · {selected.dealTruth.confidence} confidence</strong>
                  <div className="muted" style={{ marginTop: "0.35rem" }}>
                    Opportunity {selected.dealTruth.opportunity} · Valuation {selected.dealTruth.valuation} · Title/legal {selected.dealTruth.titleLegal} · Auction safety {selected.dealTruth.auctionSafety} · Liquidity {selected.dealTruth.liquidity}
                  </div>
                  {selected.dealTruth.reasons.length ? (
                    <div style={{ marginTop: "0.35rem" }}>{selected.dealTruth.reasons.join(" ")}</div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.metricGrid}>
                <div onContextMenu={(e) => openAiContext(e, "Property score", String(selected.score))} title="Right-click to ask AI">
                  <span>Score</span>
                  <strong className="mono">{selected.score}</strong>
                </div>
                <div onContextMenu={(e) => openAiContext(e, "Equity spread", pct(selected.equitySpread))} title="Right-click to ask AI">
                  <span>Spread</span>
                  <strong className="mono">{pct(selected.equitySpread)}</strong>
                </div>
                <div>
                  <span>Est. market</span>
                  <strong className="mono">{money(selected.estimatedMarketMid)}</strong>
                </div>
                <div>
                  <span>Tract median</span>
                  <strong className="mono">{money(selected.tractMedianHomeValue)}</strong>
                </div>
              </div>

              {diligence ? (
                <>
                  <div
                    className={`${styles.alert} ${
                      diligence.overbid.level === "danger"
                        ? styles.alertDanger
                        : diligence.overbid.level === "caution"
                          ? styles.alertCaution
                          : styles.alertOk
                    }`}
                  >
                    <strong>Overbid guard:</strong> {diligence.overbid.message}
                  </div>
                  <div className={styles.rulesBox}>
                    <strong>{diligence.rules.label}</strong>
                    <div style={{ marginTop: "0.35rem" }}>{diligence.rules.redemptionSummary}</div>
                    <div style={{ marginTop: "0.35rem" }} className="muted">
                      Valuation: {diligence.valuation.label} — {diligence.valuation.detail}
                    </div>
                  </div>
                  <h3>Pre-bid checklist</h3>
                  <ul className={styles.checkList}>
                    {diligence.checklist.map((item) => (
                      <li key={item.id}>
                        <label className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={Boolean(checkedItems[item.id])}
                            onChange={() => toggleCheck(item.id)}
                          />
                          <span>
                            <em className={item.severity === "required" ? styles.req : undefined}>
                              {item.severity}
                            </em>{" "}
                            {item.label}
                            {item.autoHint ? (
                              <div className="muted" style={{ fontSize: "0.82rem" }}>
                                {item.autoHint}
                              </div>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <button className="btn btn-ghost" onClick={() => recalcMaxBid(selected)}>
                Lock max bid with my settings
              </button>

              <div className={styles.bidBox}>
                <div onContextMenu={(e) => openAiContext(e, "Max bid", money(selected.maxBid))} title="Right-click to ask AI">
                  <span className="muted">Max bid</span>
                  <strong className="mono">{money(selected.maxBid)}</strong>
                </div>
                <div onContextMenu={(e) => openAiContext(e, "Projected profit", money(selected.projectedProfitAtMaxBid))} title="Right-click to ask AI">
                  <span className="muted">Projected profit</span>
                  <strong className="mono">{money(selected.projectedProfitAtMaxBid)}</strong>
                </div>
                <div onContextMenu={(e) => openAiContext(e, "Cry-out bid", money(selected.cry_out_bid))} title="Right-click to ask AI">
                  <span className="muted">Cry-out bid</span>
                  <strong className="mono">{money(selected.cry_out_bid)}</strong>
                </div>
                {liveBidPreview && liveBidPreview.maxBid !== selected.maxBid ? (
                  <div>
                    <span className="muted">Preview (not applied)</span>
                    <strong className="mono">{money(liveBidPreview.maxBid)}</strong>
                  </div>
                ) : null}
              </div>

              <h3>Research links</h3>
              <div className="link-row">
                <a href={selected.assessorUrl} target="_blank" rel="noreferrer">
                  Assessor
                </a>
                <a href={selected.zillowUrl} target="_blank" rel="noreferrer">
                  Zillow
                </a>
                <a href={selected.redfinUrl} target="_blank" rel="noreferrer">
                  Redfin
                </a>
                <a href={selected.regridUrl} target="_blank" rel="noreferrer">
                  Regrid
                </a>
                <a href={selected.googleMapsUrl} target="_blank" rel="noreferrer">
                  Maps
                </a>
              </div>

              <h3>Notes</h3>
              <p className={styles.notes}>{selected.notes}</p>

              {selected.redFlags.length ? (
                <>
                  <h3>Red flags</h3>
                  <ul className={styles.flags}>
                    {selected.redFlags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p className="muted">Select a property to inspect.</p>
          )}
        </aside>
      </div> : null}
      <button className={styles.conciergeFab} onClick={() => setConciergeOpen((v) => !v)} aria-expanded={conciergeOpen}>
        ✦ FirstLook Copilot
      </button>
      {aiContextMenu ? (
        <div className={styles.aiContextMenu} style={{ left: aiContextMenu.x, top: aiContextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => void askConcierge(`Explain this metric in context: ${aiContextMenu.label} = ${aiContextMenu.value}. Why does it matter for this deal?`)}>✦ Ask Copilot</button>
          <button onClick={() => void askConcierge(`Audit this calculation/metric for a possible bug: ${aiContextMenu.label} = ${aiContextMenu.value}. Recompute it and identify whether the algorithm or assumptions are wrong.`, true)}>⚙ Audit / diagnose</button>
        </div>
      ) : null}
      {conciergeOpen ? (
        <section className={styles.conciergePanel} aria-label="FirstLook Copilot">
          <div className={styles.conciergeHead}>
            <div><strong>✦ FirstLook Copilot</strong><div className="muted">{selected ? selected.cleanAddress : "Portfolio assistant"} · investor help + admin diagnostics</div></div>
            <button className="btn btn-ghost" onClick={() => setConciergeOpen(false)}>×</button>
          </div>
          <div className={styles.conciergeMessages} ref={conciergeScrollRef}>
            {conciergeMessages.map((m, i) => (
              <div key={i} className={m.role === "user" ? styles.userMessage : styles.aiMessage}>
                <small>{m.role === "user" ? "You" : "FirstLook Copilot"}</small>
                <div>{m.text}</div>
              </div>
            ))}
            {conciergeLoading ? <div className={styles.aiMessage}><small>FirstLook Copilot</small><div>Inspecting current feature, evidence and calculations…</div></div> : null}
          </div>
          <div className={styles.conciergeQuick}>
            {["Why this score?", "Explain max bid", "Audit this calculation", "Find issues on this screen", "What should I verify next?"].map((q) => (
              <button key={q} className="btn btn-ghost" onClick={() => void askConcierge(q)} disabled={conciergeLoading}>{q}</button>
            ))}
          </div>
          <details className={styles.copilotAdmin}><summary>Developer diagnostics</summary><div><span>Admin repair mode</span><input type="password" autoComplete="off" value={engineerKey} onChange={(e)=>setEngineerKey(e.target.value)} placeholder="Admin key for calculation / UI diagnostics" /></div></details><div className={styles.conciergeInput}>
            <textarea rows={2} value={conciergeQuestion} onChange={(e) => setConciergeQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void askConcierge(); } }} placeholder="Ask about the deal, or say: audit this calculation / find the issue / fix this feature…" />
            <button className="btn btn-primary" onClick={() => void askConcierge()} disabled={conciergeLoading || !conciergeQuestion.trim()}>Ask</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
