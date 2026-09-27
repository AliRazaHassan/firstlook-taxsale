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
};

const BUY_BOX_KEY = "firstlook-buy-box-v2";
const BID_KEY = "firstlook-bid-defaults-v2";

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
  if (typeof window === "undefined") {
    return { rehab: 25000, holdingMonths: 4, monthlyHolding: 500, desiredProfitPct: 15 };
  }
  try {
    const raw = localStorage.getItem(BID_KEY);
    if (!raw) throw new Error("empty");
    return { rehab: 25000, holdingMonths: 4, monthlyHolding: 500, desiredProfitPct: 15, ...JSON.parse(raw) };
  } catch {
    return { rehab: 25000, holdingMonths: 4, monthlyHolding: 500, desiredProfitPct: 15 };
  }
}

function hasHeadroom(p: ScoredProperty): boolean {
  return p.maxBid != null && p.maxBid > 0 && p.cry_out_bid < p.maxBid * 0.85;
}

function isOverbidRisk(p: ScoredProperty): boolean {
  return p.maxBid == null || p.maxBid <= 0 || p.cry_out_bid >= p.maxBid;
}

export default function AppPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [osModule, setOsModule] = useState<OsModule>("taxsale");
  const [dealStrategy, setDealStrategy] = useState<DealStrategy>("flip");
  const [dealInputs, setDealInputs] = useState({ purchasePrice: 0, arv: 0, rehab: 25000, monthlyRent: 0, downPaymentPct: 20, interestRate: 7.5, loanYears: 30, vacancyPct: 5, managementPct: 8, taxesMonthly: 0, insuranceMonthly: 0, otherMonthly: 0, buyClosingPct: 2, sellClosingPct: 8, holdingMonths: 6, monthlyHolding: 650, contingencyPct: 10, refiLtvPct: 75, refiClosingPct: 3 });
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
  const conciergeScrollRef = useRef<HTMLDivElement | null>(null);

  const buyBoxRef = useRef(buyBox);
  const bidRef = useRef(bidDefaults);
  buyBoxRef.current = buyBox;
  bidRef.current = bidDefaults;

  const bidPayload = useMemo(
    () => ({
      rehab: bidDefaults.rehab,
      holdingMonths: bidDefaults.holdingMonths,
      monthlyHolding: bidDefaults.monthlyHolding,
      desiredProfitPct: bidDefaults.desiredProfitPct / 100,
    }),
    [bidDefaults],
  );

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
      const bid = bidRef.current;
      const next = rescoreExisting(properties, box, {
        rehab: bid.rehab,
        holdingMonths: bid.holdingMonths,
        monthlyHolding: bid.monthlyHolding,
        desiredProfitPct: bid.desiredProfitPct / 100,
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
    setDealInputs((v) => ({ ...v, purchasePrice: selected.cry_out_bid, arv: selected.estimatedMarketMid ?? selected.assessed_fmv, rehab: bidDefaults.rehab, monthlyRent: 0, taxesMonthly: 0, insuranceMonthly: 0 }));
  }, [selected?.parcel_id]);

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
    const buyClosing = d.purchasePrice * safePct(d.buyClosingPct);
    const rehabContingency = d.rehab * safePct(d.contingencyPct);
    const holding = Math.max(0, d.holdingMonths) * Math.max(0, d.monthlyHolding);
    const cashNeeded = down + buyClosing + d.rehab + rehabContingency;
    const capRate = d.purchasePrice > 0 ? annualNoi / d.purchasePrice : 0;
    const cashOnCash = cashNeeded > 0 ? cashFlow * 12 / cashNeeded : 0;
    const sellClosing = d.arv * safePct(d.sellClosingPct);
    const flipProfit = d.arv - d.purchasePrice - buyClosing - d.rehab - rehabContingency - holding - sellClosing;
    const targetProfit = d.arv * 0.15;
    const mao = Math.max(0, d.arv - sellClosing - d.rehab - rehabContingency - holding - targetProfit - (d.arv * safePct(d.buyClosingPct)));
    const refiGross = d.arv * safePct(d.refiLtvPct);
    const refiClosing = refiGross * safePct(d.refiClosingPct);
    const refiNet = Math.max(0, refiGross - refiClosing);
    const initialCashBasis = cashNeeded + holding;
    const cashLeftIn = Math.max(0, initialCashBasis - refiNet);
    const warnings = [
      d.arv <= 0 ? "Working ARV is missing." : null,
      d.monthlyRent <= 0 && dealStrategy !== "flip" ? "Monthly rent is missing; rental returns are not decision-ready." : null,
      d.taxesMonthly <= 0 && dealStrategy !== "flip" ? "Property tax assumption is missing." : null,
      d.insuranceMonthly <= 0 && dealStrategy !== "flip" ? "Insurance assumption is missing." : null,
      "Working ARV is an estimate until property-level sold comps are verified.",
    ].filter(Boolean) as string[];
    return { down, loan, mortgage, monthlyExpenses, cashFlow, annualNoi, cashNeeded, capRate, cashOnCash, flipProfit, mao, refiGross, refiClosing, refiNet, cashLeftIn, buyClosing, sellClosing, rehabContingency, holding, warnings };
  }, [dealInputs, dealStrategy]);

  const investorIntel = useMemo(() => {
    const props = data?.properties ?? [];
    const diligenceTotal = diligence?.checklist.length ?? 0;
    const diligenceDone = Object.values(checkedItems).filter(Boolean).length;
    const missing: Array<{label:string; module:OsModule; why:string}> = [];
    if (dealInputs.monthlyRent <= 0) missing.push({ label: "Add market rent", module: "analyzer", why: "Rental and BRRRR returns cannot be trusted without rent." });
    if (dealInputs.taxesMonthly <= 0) missing.push({ label: "Verify property taxes", module: "diligence", why: "Taxes materially change NOI and cash flow." });
    if (dealInputs.insuranceMonthly <= 0) missing.push({ label: "Add insurance quote", module: "analyzer", why: "Insurance is still an assumption." });
    missing.push({ label: "Verify sold comps / ARV", module: "comps", why: "Current ARV is modeled context, not property-level sold comps." });
    if (diligenceDone < diligenceTotal) missing.push({ label: `Finish diligence (${diligenceDone}/${diligenceTotal})`, module: "diligence", why: "Unchecked title, lien, occupancy or auction items can change the deal." });
    const look = props.filter(p=>p.lookAtFirst);
    const totalModeledValue = props.reduce((s,p)=>s+(p.estimatedMarketMid ?? p.assessed_fmv ?? 0),0);
    const totalCryOut = props.reduce((s,p)=>s+(p.cry_out_bid ?? 0),0);
    const flagged = props.filter(p=>p.redFlags.length>0).length;
    const selectedReadiness = Math.max(0, 100 - Math.min(100, missing.length * 16));
    return { missing, look, totalModeledValue, totalCryOut, flagged, selectedReadiness };
  }, [data, diligence, checkedItems, dealInputs.monthlyRent, dealInputs.taxesMonthly, dealInputs.insuranceMonthly]);

  const liveBidPreview = useMemo(() => {
    if (!selected) return null;
    const arv = selected.estimatedMarketMid ?? selected.assessed_fmv;
    return calculateMaxBid({
      arv,
      rehab: bidDefaults.rehab,
      holdingMonths: bidDefaults.holdingMonths,
      monthlyHolding: bidDefaults.monthlyHolding,
      desiredProfit: Math.round(arv * (bidDefaults.desiredProfitPct / 100)),
      cryOutBid: selected.cry_out_bid,
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
      setError(json.error ?? "Watch failed");
      return;
    }
    setWatchMsg(json.message);
  }

  function recalcMaxBid(property: ScoredProperty) {
    const arv = property.estimatedMarketMid ?? property.assessed_fmv;
    const json = calculateMaxBid({
      arv,
      rehab: bidDefaults.rehab,
      holdingMonths: bidDefaults.holdingMonths,
      monthlyHolding: bidDefaults.monthlyHolding,
      desiredProfit: Math.round(arv * (bidDefaults.desiredProfitPct / 100)),
      cryOutBid: property.cry_out_bid,
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

  async function askConcierge(question = conciergeQuestion) {
    if (!question.trim()) return;
    setConciergeOpen(true);
    setAiContextMenu(null);
    setConciergeMessages((m) => [...m, { role: "user", text: question }]);
    setConciergeQuestion("");
    setConciergeLoading(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          property: selected ?? undefined,
          diligence,
          analysis: { module: osModule, strategy: dealStrategy, inputs: dealInputs, results: dealAnalysis },
          portfolio: { total: data?.total, lookFirstCount: data?.lookFirstCount },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Concierge failed");
      setConciergeMessages((m) => [...m, { role: "assistant", text: json.answer }]);
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
              <div className={styles.strategyTabs}>{(["flip","rental","brrrr"] as DealStrategy[]).map(s => <button key={s} className={dealStrategy === s ? styles.osNavActive : ""} onClick={() => setDealStrategy(s)}>{s.toUpperCase()}</button>)}</div>
              <div className={styles.osMetrics}>
                <div onContextMenu={(e)=>openAiContext(e,"Purchase price",money(dealInputs.purchasePrice))}><span>Purchase</span><strong>{money(dealInputs.purchasePrice)}</strong></div>
                <div onContextMenu={(e)=>openAiContext(e,"Working ARV",money(dealInputs.arv))}><span>Working ARV <em className={styles.evidenceEstimate}>Estimate</em></span><strong>{money(dealInputs.arv)}</strong></div>
                <div onContextMenu={(e)=>openAiContext(e,"Rehab assumption",money(dealInputs.rehab))}><span>Rehab <em className={styles.evidenceAssumption}>Assumption</em></span><strong>{money(dealInputs.rehab)}</strong></div>
                {dealStrategy === "flip" ? <><div onContextMenu={(e)=>openAiContext(e,"Flip profit",money(dealAnalysis.flipProfit))}><span>Projected profit</span><strong>{money(dealAnalysis.flipProfit)}</strong></div><div><span>70% MAO</span><strong>{money(dealAnalysis.mao)}</strong></div></> : <><div><span>Cash flow / mo</span><strong>{money(dealAnalysis.cashFlow)}</strong></div><div><span>Cash-on-cash</span><strong>{pct(dealAnalysis.cashOnCash)}</strong></div></>}
              </div>
              <div className={styles.analyzerGrid}>
                <div className="panel">
                  <h2>Deal assumptions</h2><div className={styles.trustNotice}><strong>Evidence-aware analysis</strong><span>Green = public-record input · amber = model estimate · blue = your assumption. Verify comps, rent, taxes, insurance, condition and title before committing capital.</span></div>
                  <div className={styles.inputGrid}>
                    {([["purchasePrice","Purchase price"],["arv","Working ARV"],["rehab","Base rehab"],["monthlyRent","Monthly rent"],["downPaymentPct","Down payment %"],["interestRate","Interest rate %"],["loanYears","Loan years"],["vacancyPct","Vacancy %"],["managementPct","Management %"],["taxesMonthly","Taxes / mo"],["insuranceMonthly","Insurance / mo"],["otherMonthly","Other / mo"],["buyClosingPct","Buy closing %"],["sellClosingPct","Sell/disposition %"],["holdingMonths","Holding months"],["monthlyHolding","Holding cost / mo"],["contingencyPct","Rehab contingency %"],["refiLtvPct","Refi LTV %"],["refiClosingPct","Refi closing %"]] as const).map(([key,label]) => <label key={key}><span>{label}{key === "arv" ? <em className={styles.evidenceEstimate}>Estimate</em> : key === "purchasePrice" ? <em className={styles.evidencePublic}>Public record</em> : <em className={styles.evidenceAssumption}>Assumption</em>}</span><input min="0" type="number" step="any" value={dealInputs[key]} onChange={(e)=>setDealInputs(v=>({...v,[key]:Math.max(0,Number(e.target.value)||0)}))}/></label>)}
                  </div>
                </div>
                <div className="panel">
                  <h2>{dealStrategy === "flip" ? "Flip outcome" : dealStrategy === "rental" ? "Rental outcome" : "BRRRR outcome"}</h2>
                  <div className={styles.outcomeList}>{dealAnalysis.warnings.length ? <div className={styles.analysisWarnings}>{dealAnalysis.warnings.map(w=><p key={w}>⚠ {w}</p>)}</div> : null}
                    {dealStrategy === "flip" ? <><p><span>Projected profit</span><strong>{money(dealAnalysis.flipProfit)}</strong></p><p><span>Maximum allowable offer</span><strong>{money(dealAnalysis.mao)}</strong></p><p><span>Cash needed</span><strong>{money(dealAnalysis.cashNeeded)}</strong></p></> : <><p><span>Mortgage</span><strong>{money(dealAnalysis.mortgage)}/mo</strong></p><p><span>Cash flow</span><strong>{money(dealAnalysis.cashFlow)}/mo</strong></p><p><span>Cap rate</span><strong>{pct(dealAnalysis.capRate)}</strong></p><p><span>Cash-on-cash</span><strong>{pct(dealAnalysis.cashOnCash)}</strong></p>{dealStrategy === "brrrr" ? <><p><span>Gross refinance ({dealInputs.refiLtvPct}% LTV)</span><strong>{money(dealAnalysis.refiGross)}</strong></p><p><span>Net refi after closing</span><strong>{money(dealAnalysis.refiNet)}</strong></p><p><span>Cash left in deal</span><strong>{money(dealAnalysis.cashLeftIn)}</strong></p></> : null}</>}
                  </div>
                  <button className="btn btn-primary" onClick={()=>void askConcierge(`Analyze this ${dealStrategy} scenario. Purchase ${money(dealInputs.purchasePrice)}, ARV ${money(dealInputs.arv)}, rehab ${money(dealInputs.rehab)}, rent ${money(dealInputs.monthlyRent)}. Explain strengths, risks, and which assumptions I should verify.`)}>✦ Ask AI to analyze this deal</button>
                </div>
              </div>
            </>
          ) : selected ? (
            <div className={styles.moduleGrid}>
              {osModule === "comps" && <><div className="panel"><h2>Valuation evidence</h2><p>Assessed FMV <strong>{money(selected.assessed_fmv)}</strong></p><p>Modeled market context <strong>{money(selected.estimatedMarketMid)}</strong> <em className={styles.evidenceEstimate}>Estimate</em></p><p>ACS tract median <strong>{money(selected.tractMedianHomeValue)}</strong> <em className={styles.evidencePublic}>Public data</em></p><p className="muted">Property-level sold comps are the next data connector; neighborhood estimates are not treated as verified comps.</p></div><div className="panel"><h2>ARV workspace</h2><p>Working ARV <strong>{money(dealInputs.arv)}</strong> <em className={styles.evidenceEstimate}>Unverified estimate</em></p><button className="btn btn-primary" onClick={()=>setOsModule("analyzer")}>Use in analyzer</button></div></>}
              {osModule === "rehab" && <div className="panel"><h2>Rehab budget</h2><p>Current working budget <strong>{money(dealInputs.rehab)}</strong></p><input type="number" value={dealInputs.rehab} onChange={e=>setDealInputs(v=>({...v,rehab:Number(e.target.value)||0}))}/><p className="muted">Changes flow directly into Flip / Rental / BRRRR analysis.</p></div>}
              {osModule === "financing" && <div className="panel"><h2>Financing scenario</h2><p>Loan <strong>{money(dealAnalysis.loan)}</strong></p><p>Down payment <strong>{money(dealAnalysis.down)}</strong></p><p>Payment <strong>{money(dealAnalysis.mortgage)}/mo</strong></p><button className="btn btn-primary" onClick={()=>setOsModule("analyzer")}>Edit financing assumptions</button></div>}
              {osModule === "diligence" && <div className="panel"><h2>Diligence status</h2><p><strong>{Object.values(checkedItems).filter(Boolean).length}/{diligence?.checklist.length ?? 0}</strong> checks complete</p><p>{diligence?.rules.label}</p><button className="btn btn-primary" onClick={()=>void askConcierge("Review the current diligence checklist and tell me what remains unverified and why it matters.")}>✦ Review with AI</button></div>}
              {osModule === "pipeline" && <div className="panel"><h2>Deal pipeline</h2><div className={styles.pipelineStages}>{["New","Researching","Due diligence","Offer","Under contract","Rehab","Listed / Rented","Exited"].map((s,i)=><span key={s} className={i===1 ? styles.stageActive : ""}>{s}</span>)}</div><p className="muted">Property CRM persistence and tasks are the next backend step.</p></div>}
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
              <p className="muted">This is how FirstLook decides what “good” means for you.</p>

              <div className="field">
                <label>Min assessed value ($)</label>
                <input
                  type="number"
                  value={buyBox.minAssessedValue}
                  onChange={(e) =>
                    setBuyBox((b) => ({ ...b, minAssessedValue: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="field">
                <label>Max tax burden % of FMV</label>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(buyBox.maxTaxBurdenRatio * 1000) / 10}
                  onChange={(e) =>
                    setBuyBox((b) => ({
                      ...b,
                      maxTaxBurdenRatio: (Number(e.target.value) || 0) / 100,
                    }))
                  }
                />
              </div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={buyBox.preferResidential}
                  onChange={(e) => setBuyBox((b) => ({ ...b, preferResidential: e.target.checked }))}
                />
                Prefer residential
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={buyBox.avoidVacantLand}
                  onChange={(e) => setBuyBox((b) => ({ ...b, avoidVacantLand: e.target.checked }))}
                />
                Avoid vacant / low-value land
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={buyBox.avoidLlcInvestorOwned}
                  onChange={(e) =>
                    setBuyBox((b) => ({ ...b, avoidLlcInvestorOwned: e.target.checked }))
                  }
                />
                Soft-penalize LLC / investor owners
              </label>

              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => applyBuyBoxAndBids()}
                disabled={!data}
              >
                Apply buy box to list
              </button>
            </>
          ) : null}

          {sideTab === "bid" ? (
            <>
              <h2>Max bid settings</h2>
              <p className="muted">Stops overbidding — the #1 auction money leak.</p>
              <div className="field">
                <label>Default rehab ($)</label>
                <input
                  type="number"
                  value={bidDefaults.rehab}
                  onChange={(e) =>
                    setBidDefaults((b) => ({ ...b, rehab: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="field">
                <label>Holding months</label>
                <input
                  type="number"
                  value={bidDefaults.holdingMonths}
                  onChange={(e) =>
                    setBidDefaults((b) => ({ ...b, holdingMonths: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="field">
                <label>Monthly holding ($)</label>
                <input
                  type="number"
                  value={bidDefaults.monthlyHolding}
                  onChange={(e) =>
                    setBidDefaults((b) => ({ ...b, monthlyHolding: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="field">
                <label>Desired profit % of ARV</label>
                <input
                  type="number"
                  value={bidDefaults.desiredProfitPct}
                  onChange={(e) =>
                    setBidDefaults((b) => ({
                      ...b,
                      desiredProfitPct: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              {liveBidPreview && selected ? (
                <div className={styles.bidPreview}>
                  <span className="muted">Live preview · {selected.cleanAddress}</span>
                  <strong className="mono">{money(liveBidPreview.maxBid)}</strong>
                  <span className="muted">
                    Profit at ceiling ≈ {money(liveBidPreview.projectedProfit)}
                  </span>
                </div>
              ) : null}
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => applyBuyBoxAndBids()}
                disabled={!data}
              >
                Apply max bids to whole list
              </button>
            </>
          ) : null}

          {sideTab === "watch" ? (
            <>
              <h2>County watch</h2>
              <p className="muted">
                Phase 4: register for new tax-sale list alerts in your counties.
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
        AI Concierge
      </button>
      {aiContextMenu ? (
        <div className={styles.aiContextMenu} style={{ left: aiContextMenu.x, top: aiContextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => void askConcierge(`Explain this metric in context: ${aiContextMenu.label} = ${aiContextMenu.value}. Why does it matter for this deal?`)}>
            ✦ Ask AI about this
          </button>
        </div>
      ) : null}
      {conciergeOpen ? (
        <section className={styles.conciergePanel} aria-label="FirstLook AI Concierge">
          <div className={styles.conciergeHead}>
            <div><strong>✦ FirstLook AI Concierge</strong><div className="muted">{selected ? selected.cleanAddress : "Portfolio assistant"} · grounded in current results</div></div>
            <button className="btn btn-ghost" onClick={() => setConciergeOpen(false)}>×</button>
          </div>
          <div className={styles.conciergeMessages} ref={conciergeScrollRef}>
            {conciergeMessages.map((m, i) => (
              <div key={i} className={m.role === "user" ? styles.userMessage : styles.aiMessage}>
                <small>{m.role === "user" ? "You" : "AI Concierge"}</small>
                <div>{m.text}</div>
              </div>
            ))}
            {conciergeLoading ? <div className={styles.aiMessage}><small>AI Concierge</small><div>Reviewing the evidence…</div></div> : null}
          </div>
          <div className={styles.conciergeQuick}>
            {["Why this score?", "Explain max bid", "What are the risks?", "What should I verify next?"].map((q) => (
              <button key={q} className="btn btn-ghost" onClick={() => void askConcierge(q)} disabled={conciergeLoading}>{q}</button>
            ))}
          </div>
          <div className={styles.conciergeInput}>
            <textarea rows={2} value={conciergeQuestion} onChange={(e) => setConciergeQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void askConcierge(); } }} placeholder="Ask anything about these results…" />
            <button className="btn btn-primary" onClick={() => void askConcierge()} disabled={conciergeLoading || !conciergeQuestion.trim()}>Ask</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
