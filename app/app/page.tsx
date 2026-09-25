"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_BUY_BOX, type BuyBox, type ScoredProperty } from "@/lib/engine";
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

type FilterMode = "all" | "look" | "flagged";
type SideTab = "research" | "buybox" | "bid" | "watch";

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

function loadBuyBox(): BuyBox {
  if (typeof window === "undefined") return { ...DEFAULT_BUY_BOX, weights: { ...DEFAULT_BUY_BOX.weights }, redFlags: { ...DEFAULT_BUY_BOX.redFlags, vacantLandKeywords: [...DEFAULT_BUY_BOX.redFlags.vacantLandKeywords] } };
  try {
    const raw = localStorage.getItem(BUY_BOX_KEY);
    if (!raw) throw new Error("empty");
    return { ...DEFAULT_BUY_BOX, ...JSON.parse(raw) } as BuyBox;
  } catch {
    return {
      ...DEFAULT_BUY_BOX,
      weights: { ...DEFAULT_BUY_BOX.weights },
      redFlags: {
        ...DEFAULT_BUY_BOX.redFlags,
        vacantLandKeywords: [...DEFAULT_BUY_BOX.redFlags.vacantLandKeywords],
      },
    };
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

export default function AppPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
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

  const bidPayload = useMemo(
    () => ({
      rehab: bidDefaults.rehab,
      holdingMonths: bidDefaults.holdingMonths,
      monthlyHolding: bidDefaults.monthlyHolding,
      desiredProfitPct: bidDefaults.desiredProfitPct / 100,
    }),
    [bidDefaults],
  );

  const applyResponse = useCallback((json: ResearchResponse) => {
    setData(json);
    setSelected(json.properties.find((p) => p.lookAtFirst) ?? json.properties[0] ?? null);
  }, []);

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus("Loading Clayton County demo…");
    try {
      const res = await fetch("/api/demo");
      const json = (await res.json()) as ResearchResponse;
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Demo failed");
      applyResponse(json);
      setStatus(`Demo ready · ${json.total} parcels`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

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

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "look") return data.properties.filter((p) => p.lookAtFirst);
    if (filter === "flagged") return data.properties.filter((p) => p.redFlags.length > 0);
    return data.properties;
  }, [data, filter]);

  const impact = data?.impact;

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
        body: JSON.stringify({ csv: csvText, buyBox, bidDefaults: bidPayload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      applyResponse(json as ResearchResponse);
      setStatus(`Live research complete · ${(json as ResearchResponse).total} parcels`);
      setFilter("look");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyBuyBoxAndBids() {
    if (!data?.properties.length) {
      setError("Load demo or research a list first.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus("Re-ranking with your buy box + bid settings…");
    try {
      const res = await fetch("/api/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: data.properties,
          buyBox,
          bidDefaults: bidPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Rescore failed");
      applyResponse(json as ResearchResponse);
      setStatus("Buy box applied — shortlist updated");
      setFilter("look");
      setSideTab("research");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescore failed");
    } finally {
      setLoading(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setStatus(`Loaded ${file.name}`);
  }

  async function exportCsv(format: "full" | "bid-sheet" = "full") {
    if (!data?.properties.length) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: data.properties, format }),
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
      format === "bid-sheet" ? "firstlook-auction-bid-sheet.csv" : "firstlook-look-first.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  async function recalcMaxBid(property: ScoredProperty) {
    const arv = property.estimatedMarketMid ?? property.assessed_fmv;
    const res = await fetch("/api/max-bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arv,
        rehab: bidDefaults.rehab,
        holdingMonths: bidDefaults.holdingMonths,
        monthlyHolding: bidDefaults.monthlyHolding,
        desiredProfit: Math.round(arv * (bidDefaults.desiredProfitPct / 100)),
        cryOutBid: property.cry_out_bid,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Max bid failed");
      return;
    }
    setSelected({
      ...property,
      maxBid: json.maxBid,
      projectedProfitAtMaxBid: json.projectedProfit,
    });
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.left}>
          <Link href="/" className={styles.brand}>
            FirstLook
          </Link>
          <span className="pill pill-mint">Phase 2</span>
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
          <button className="btn btn-primary" onClick={() => void exportCsv("full")} disabled={!data || loading}>
            Export
          </button>
        </div>
      </header>

      <div className={styles.layout}>
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
              <p className="muted">Upload your county tax-sale CSV (up to 100 parcels in Phase 2).</p>

              <div className="field">
                <label>CSV file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
              </div>

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
                onClick={() => void applyBuyBoxAndBids()}
                disabled={loading || !data}
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
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.8rem" }}
                onClick={() => void applyBuyBoxAndBids()}
                disabled={loading || !data}
              >
                Recalc all max bids
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
            <strong>Phase 2 solves</strong>
            <span className="muted">
              Your rules + your max bid + ranked shortlist. Export to Google Sheets and diligence
              only the winners.
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
                <div className="panel">
                  <span className="muted">Parcels in</span>
                  <strong className="mono">{data.total}</strong>
                </div>
                <div className="panel">
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

              <div className={styles.filterRow}>
                {(
                  [
                    ["all", "All"],
                    ["look", "Look first"],
                    ["flagged", "Red flags"],
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

              <div className={`table-wrap ${styles.tablePanel}`}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Score</th>
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
              <h2>Load the demo to see how much list noise FirstLook removes</h2>
              <button className="btn btn-primary" onClick={() => void loadDemo()} disabled={loading}>
                Load Clayton demo
              </button>
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

              <div className={styles.metricGrid}>
                <div>
                  <span>Score</span>
                  <strong className="mono">{selected.score}</strong>
                </div>
                <div>
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
                        <strong>[{item.severity}]</strong> {item.label}
                        {item.autoHint ? (
                          <div className="muted" style={{ fontSize: "0.82rem" }}>
                            {item.autoHint}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <button className="btn btn-ghost" onClick={() => void recalcMaxBid(selected)}>
                Recalc max bid with my settings
              </button>

              <div className={styles.bidBox}>
                <div>
                  <span className="muted">Max bid</span>
                  <strong className="mono">{money(selected.maxBid)}</strong>
                </div>
                <div>
                  <span className="muted">Projected profit</span>
                  <strong className="mono">{money(selected.projectedProfitAtMaxBid)}</strong>
                </div>
                <div>
                  <span className="muted">Cry-out bid</span>
                  <strong className="mono">{money(selected.cry_out_bid)}</strong>
                </div>
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
      </div>
    </main>
  );
}
