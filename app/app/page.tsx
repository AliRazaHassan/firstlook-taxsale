"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ScoredProperty } from "@/lib/engine";
import { money, pct } from "@/lib/format";
import styles from "./app.module.css";

type ResearchResponse = {
  mode: string;
  county?: string;
  saleDate?: string;
  total: number;
  lookFirstCount: number;
  geocoded: number;
  properties: ScoredProperty[];
  error?: string;
};

type FilterMode = "all" | "look" | "flagged";

export default function AppPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selected, setSelected] = useState<ScoredProperty | null>(null);
  const [csvText, setCsvText] = useState("");
  const [rehab, setRehab] = useState(25000);
  const [status, setStatus] = useState("Ready");

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus("Loading Clayton County demo…");
    try {
      const res = await fetch("/api/demo");
      const json = (await res.json()) as ResearchResponse;
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Demo failed");
      setData(json);
      setSelected(json.properties.find((p) => p.lookAtFirst) ?? json.properties[0] ?? null);
      setStatus(`Demo ready · ${json.total} parcels`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDemo();
  }, [loadDemo]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "look") return data.properties.filter((p) => p.lookAtFirst);
    if (filter === "flagged") return data.properties.filter((p) => p.redFlags.length > 0);
    return data.properties;
  }, [data, filter]);

  async function runLiveResearch() {
    if (!csvText.trim()) {
      setError("Paste a tax-sale CSV first (or use the demo).");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus("Researching parcels via Census + ACS… this can take 1–2 minutes");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      setData(json as ResearchResponse);
      const props = (json as ResearchResponse).properties;
      setSelected(props.find((p) => p.lookAtFirst) ?? props[0] ?? null);
      setStatus(`Live research complete · ${props.length} parcels`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
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

  async function exportCsv() {
    if (!data?.properties.length) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: data.properties }),
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
    a.download = "firstlook-taxsale-research.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function recalcMaxBid(property: ScoredProperty) {
    const arv = property.estimatedMarketMid ?? property.assessed_fmv;
    const res = await fetch("/api/max-bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arv,
        rehab,
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
          <span className="pill pill-mint">MVP</span>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={() => void loadDemo()} disabled={loading}>
            Load demo
          </button>
          <button className="btn btn-primary" onClick={() => void exportCsv()} disabled={!data || loading}>
            Export CSV
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={`panel ${styles.sidebar}`}>
          <h2>Run research</h2>
          <p className="muted">Upload or paste a county tax-sale CSV (max 30 parcels).</p>

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
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="sale_date,parcel_id,owner,address,tax_years,assessed_fmv,cry_out_bid,..."
            />
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => void runLiveResearch()} disabled={loading}>
            {loading ? "Working…" : "Research my list"}
          </button>

          <p className={`${styles.status} muted`}>{status}</p>
          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.hint}>
            <strong>Columns</strong>
            <code>parcel_id, owner, address, assessed_fmv, cry_out_bid, tax_years, county, state</code>
          </div>
        </aside>

        <section className={styles.main}>
          {data ? (
            <>
              <div className={styles.summary}>
                <div className="panel">
                  <span className="muted">Parcels</span>
                  <strong className="mono">{data.total}</strong>
                </div>
                <div className="panel">
                  <span className="muted">Look first</span>
                  <strong className="mono">{data.lookFirstCount}</strong>
                </div>
                <div className="panel">
                  <span className="muted">Geocoded</span>
                  <strong className="mono">{data.geocoded}</strong>
                </div>
                <div className="panel">
                  <span className="muted">Mode</span>
                  <strong>{data.mode}</strong>
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
              <h2>Load the demo to see ranked tax-sale picks</h2>
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

              <div className="field">
                <label>Rehab estimate for max bid</label>
                <input
                  type="number"
                  value={rehab}
                  onChange={(e) => setRehab(Number(e.target.value) || 0)}
                />
              </div>
              <button className="btn btn-ghost" onClick={() => void recalcMaxBid(selected)}>
                Recalc max bid
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
