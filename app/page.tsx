import Link from "next/link";
import { SparkBars, WorkflowDiagram } from "@/components/Charts";
import styles from "./page.module.css";

const sampleNoiseCut = [27, 24, 19, 14, 11, 8, 6, 5];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.gridBg} aria-hidden />
      <div className={styles.wash} aria-hidden />

      <header className={`container ${styles.nav}`}>
        <div className={styles.brand}>FirstLook</div>
        <nav className={styles.navLinks}>
          <a href="#gap">Market gap</a>
          <a href="#phases">Phases</a>
          <a href="#pricing">Pricing</a>
          <Link href="/app" className="btn btn-primary">
            Open workspace
          </Link>
        </nav>
      </header>

      <section className={`container ${styles.hero}`}>
        <p className={`${styles.kicker} rise`}>Tax-sale bid discipline OS</p>
        <h1 className={`${styles.logoHero} rise-2`}>FirstLook</h1>
        <p className={`${styles.sub} rise-3`}>
          Turn a raw tax-sale list into a disciplined investment decision. FirstLook ranks the list,
          exposes the evidence behind the deal, calculates a walk-away bid ceiling, stress-tests the
          economics, and keeps the next action visible.
        </p>
        <div className={`${styles.ctaRow} rise-3`}>
          <Link href="/app" className="btn btn-primary">
            Run live demo
          </Link>
          <a href="/api/export" className="btn btn-ghost">
            Download CSV template
          </a>
        </div>

        <div className={styles.capabilityStrip}>
          <span>Buy Box ranking</span>
          <span>Max Bid + MAO</span>
          <span>Property 360</span>
          <span>Flip / Rental / BRRRR</span>
          <span>Evidence Ledger</span>
          <span>FirstLook Copilot</span>
        </div>

        <div className={styles.heroProof}>
          <div><strong>Deterministic math</strong><span>Core underwriting is calculated by tested engine logic, not invented by AI.</span></div>
          <div><strong>Evidence-aware</strong><span>Facts, estimates, assumptions and unresolved items stay visibly separated.</span></div>
          <div><strong>Bid discipline</strong><span>Look First requires Buy Box fit and real headroom below the modeled ceiling.</span></div>
        </div>

        <div className={`${styles.heroViz} rise-3`}>
          <WorkflowDiagram />
          <div className={styles.heroChart}>
            <SparkBars values={sampleNoiseCut} label="Noise cut · demo shape" />
            <p className="muted">
              Clayton sample: 27 parcels in → 5 look-first. The chart is the product pitch —
              time you stop wasting.
            </p>
          </div>
        </div>
      </section>

      <section id="gap" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>From property data to a decision</h2>
        <div className={styles.gapGrid}>
          <article className="panel">
            <h3>Raw lists create research overload</h3>
            <p className="muted">
              A county list can contain dozens of parcels, but not every parcel deserves the same
              research time or capital attention.
            </p>
          </article>
          <article className="panel">
            <h3>Spreadsheets separate the evidence</h3>
            <p className="muted">
              Bid math, comps, rehab, financing and diligence usually live in different tabs and
              tools, making assumptions easy to miss.
            </p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>FirstLook keeps the decision connected</h3>
            <p className="muted">
              Upload → shortlist → Property 360 → scenarios → max bid → evidence review → diligence
              → pipeline, with Copilot reading the same deal context.
            </p>
          </article>
        </div>
      </section>

      <section id="phases" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Every phase kills a money problem</h2>
        <div className={styles.phaseList}>
          <article className="panel">
            <span className="tag tag-ok">Live</span>
            <h3>Phase 1 — Stop researching junk</h3>
            <p className="muted">Ranked look-first list from a real county posting. Cuts ~80% noise.</p>
          </article>
          <article className="panel">
            <span className="tag tag-ok">Live</span>
            <h3>Phase 2 — Score like you buy</h3>
            <p className="muted">Your buy box + max-bid settings + up to 100 parcels + sheet export.</p>
          </article>
          <article className="panel">
            <span className="tag tag-ok">Live</span>
            <h3>Phase 3 — Don’t overbid</h3>
            <p className="muted">
              Live funnel charts, valuation confidence, county rules, checklist, auction bid sheet.
            </p>
          </article>
          <article className="panel">
            <span className="tag tag-map">Infrastructure gated</span>
            <h3>Phase 4 — County watch</h3>
            <p className="muted">The UI reports the real backend state and stays disabled until persistent database + alert delivery are connected.</p>
          </article>
        </div>
      </section>

      <section id="pricing" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Price the pain you remove</h2>
        <div className={styles.pricing}>
          <article className="panel">
            <h3>Phase 1 proof</h3>
            <p className={styles.price}>$125</p>
            <p className="muted">One county list · ranked sheet</p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>Bid Discipline monthly</h3>
            <p className={styles.price}>$149/mo</p>
            <p className="muted">Buy box · max bid lock · bid sheets · county watches</p>
          </article>
        </div>
      </section>

      <footer className={`container ${styles.footer}`}>
        <div className={styles.brand}>FirstLook</div>
        <p className="muted">Built against overbids — not another pretty property database.</p>
      </footer>
    </main>
  );
}
