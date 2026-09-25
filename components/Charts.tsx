"use client";

import type { ScoredProperty } from "@/lib/engine";

type FunnelProps = {
  total: number;
  lookFirst: number;
  skipped: number;
  flagged: number;
};

export function FunnelChart({ total, lookFirst, skipped, flagged }: FunnelProps) {
  const safe = Math.max(total, 1);
  const lookW = 40 + (lookFirst / safe) * 240;
  const skipW = 40 + (skipped / safe) * 200;
  const flagW = 40 + (flagged / safe) * 160;

  return (
    <div className="chart-card" aria-label="List funnel chart">
      <div className="chart-head">
        <strong>List funnel</strong>
        <span className="chart-live">
          <i /> live
        </span>
      </div>
      <svg viewBox="0 0 360 160" className="chart-svg" role="img">
        <rect x="24" y="16" width="312" height="26" rx="3" fill="#dfe4dc" />
        <text x="34" y="34" fontSize="12" fontWeight="600" fill="#2c3640">
          In · {total} parcels
        </text>

        <rect
          x="24"
          y="54"
          width={lookW}
          height="26"
          rx="3"
          fill="#0a5746"
          className="chart-bar-grow"
        />
        <text x="34" y="72" fontSize="12" fontWeight="600" fill="#fff">
          Look first · {lookFirst}
        </text>

        <rect
          x="24"
          y="92"
          width={skipW}
          height="24"
          rx="3"
          fill="#7d887e"
          className="chart-bar-grow"
          style={{ animationDelay: "0.1s" }}
        />
        <text x="34" y="108" fontSize="11" fontWeight="600" fill="#fff">
          Skip / later · {skipped}
        </text>

        <rect
          x="24"
          y="126"
          width={flagW}
          height="22"
          rx="3"
          fill="#8a5b00"
          className="chart-bar-grow"
          style={{ animationDelay: "0.2s" }}
        />
        <text x="34" y="141" fontSize="11" fontWeight="600" fill="#fff">
          Red flags · {flagged}
        </text>
      </svg>
    </div>
  );
}

type ScoreBarsProps = {
  properties: ScoredProperty[];
};

export function ScoreBars({ properties }: ScoreBarsProps) {
  const top = [...properties].sort((a, b) => b.score - a.score).slice(0, 8);
  const max = Math.max(...top.map((p) => p.score), 1);

  return (
    <div className="chart-card" aria-label="Score distribution">
      <div className="chart-head">
        <strong>Score board</strong>
        <span className="muted chart-sub">Top {top.length}</span>
      </div>
      <svg viewBox={`0 0 360 ${Math.max(120, top.length * 22 + 16)}`} className="chart-svg" role="img">
        {top.map((p, i) => {
          const y = 12 + i * 22;
          const w = (p.score / max) * 220;
          return (
            <g key={`${p.parcel_id}-${i}`}>
              <text x="8" y={y + 11} fontSize="10" fill="#5a645c">
                #{p.rank}
              </text>
              <rect x="36" y={y} width="220" height="14" rx="2" fill="#e8ebe6" />
              <rect
                x="36"
                y={y}
                width={w}
                height="14"
                rx="2"
                fill={p.lookAtFirst ? "#0a5746" : "#1c4a72"}
                className="chart-bar-grow"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
              <text x="264" y={y + 11} fontSize="10" fill="#12181c" fontWeight="600">
                {p.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type BidGaugeProps = {
  cryOut: number;
  maxBid: number | null | undefined;
  address?: string;
};

export function BidGauge({ cryOut, maxBid, address }: BidGaugeProps) {
  const ceiling = maxBid && maxBid > 0 ? maxBid : Math.max(cryOut * 1.35, 1);
  const cryPct = Math.min(100, (cryOut / ceiling) * 100);
  const maxPct = maxBid && maxBid > 0 ? Math.min(100, (maxBid / ceiling) * 100) : 0;
  const over = maxBid != null && maxBid > 0 && cryOut >= maxBid;

  return (
    <div className="chart-card" aria-label="Bid headroom gauge">
      <div className="chart-head">
        <strong>Bid headroom</strong>
        <span className={`chart-live ${over ? "danger" : ""}`}>
          <i /> {over ? "walk" : "guard on"}
        </span>
      </div>
      {address ? <p className="chart-caption muted">{address}</p> : null}
      <svg viewBox="0 0 360 100" className="chart-svg" role="img">
        <rect x="24" y="32" width="312" height="18" rx="3" fill="#e8ebe6" />
        <rect
          x="24"
          y="32"
          width={(312 * cryPct) / 100}
          height="18"
          rx="3"
          fill={over ? "#9b2c2c" : "#1c4a72"}
          className="chart-bar-grow"
        />
        {maxBid && maxBid > 0 ? (
          <>
            <line
              x1={24 + (312 * maxPct) / 100}
              x2={24 + (312 * maxPct) / 100}
              y1="24"
              y2="58"
              stroke="#0a5746"
              strokeWidth="3"
            />
            <text
              x={Math.min(280, 24 + (312 * maxPct) / 100 - 10)}
              y="20"
              fontSize="10"
              fill="#0a5746"
              fontWeight="700"
            >
              MAX
            </text>
          </>
        ) : null}
        <text x="24" y="82" fontSize="11" fill="#5a645c">
          Cry-out ${Math.round(cryOut).toLocaleString()}
        </text>
        <text x="210" y="82" fontSize="11" fill="#0a5746" fontWeight="600">
          Max {maxBid != null ? `$${Math.round(maxBid).toLocaleString()}` : "—"}
        </text>
      </svg>
    </div>
  );
}

export function WorkflowDiagram() {
  const steps = [
    { n: "01", t: "County list", d: "Official CSV / posting" },
    { n: "02", t: "Rank + cut", d: "Look-first shortlist" },
    { n: "03", t: "Lock max bid", d: "Walk-away ceiling" },
    { n: "04", t: "Bid sheet", d: "Auction-day printout" },
  ];

  return (
    <div className="flow-diagram" aria-label="How FirstLook works">
      <svg className="flow-lines" viewBox="0 0 800 40" preserveAspectRatio="none" aria-hidden>
        <path
          d="M40 20 H760"
          fill="none"
          stroke="#0a5746"
          strokeWidth="2"
          strokeDasharray="6 8"
          className="flow-dash"
        />
      </svg>
      <ol className="flow-steps">
        {steps.map((s) => (
          <li key={s.n}>
            <span className="flow-n">{s.n}</span>
            <strong>{s.t}</strong>
            <span className="muted">{s.d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type SparklineProps = {
  values: number[];
  label: string;
};

export function SparkBars({ values, label }: SparklineProps) {
  const max = Math.max(...values, 1);
  const h = 56;
  const gap = 4;
  const barW = Math.max(6, (280 - gap * values.length) / values.length);

  return (
    <div className="chart-card compact" aria-label={label}>
      <div className="chart-head">
        <strong>{label}</strong>
        <span className="chart-live">
          <i /> live
        </span>
      </div>
      <svg viewBox={`0 0 300 ${h + 8}`} className="chart-svg" role="img">
        {values.map((v, i) => {
          const bh = Math.max(4, (v / max) * h);
          return (
            <rect
              key={i}
              x={10 + i * (barW + gap)}
              y={h - bh + 4}
              width={barW}
              height={bh}
              rx="2"
              fill={i === values.length - 1 ? "#0a5746" : "#9bb5a8"}
              className="chart-bar-grow"
              style={{ animationDelay: `${i * 0.04}s` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
