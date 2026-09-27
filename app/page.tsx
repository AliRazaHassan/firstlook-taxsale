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
        <div className={styles.brandWrap}>
          <div className={styles.brand}>FirstLook</div>
          <span>Real Estate Investor OS</span>
        </div>
        <nav className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#why">Why FirstLook</a>
          <a href="#demo">Live demo</a>
          <Link href="/app" className="btn btn-primary">Open live demo</Link>
        </nav>
      </header>

      <section className={`container ${styles.salesHero}`}>
        <div className={styles.salesHeroCopy}>
          <p className={`${styles.kicker} rise`}>For tax-sale investors & acquisition teams</p>
          <h1 className={`${styles.salesHeadline} rise-2`}>
            Stop researching every property.
            <span>Know what deserves your money.</span>
          </h1>
          <p className={`${styles.salesSub} rise-3`}>
            FirstLook turns a raw county tax-sale list into a ranked, evidence-aware investment workflow —
            with Buy Box screening, max-bid discipline, Flip / Rental / BRRRR analysis, diligence, and an AI Copilot that reads the same deal context.
          </p>

          <div className={`${styles.ctaRow} rise-3`}>
            <Link href="/app" className="btn btn-primary">Run the live product</Link>
            <a href="#demo" className="btn btn-ghost">See the 5-minute workflow</a>
          </div>

          <div className={styles.salesProofRow}>
            <div><strong>Rank the list</strong><span>Find the parcels worth researching first.</span></div>
            <div><strong>Lock the ceiling</strong><span>See the walk-away bid before auction pressure.</span></div>
            <div><strong>Show the evidence</strong><span>Separate facts, estimates, assumptions, and unresolved items.</span></div>
          </div>
        </div>

        <div className={styles.salesHeroVisual}>
          <div className={styles.previewCard}>
            <div className={styles.previewHead}>
              <div><span>FIRSTLOOK / DEAL PREVIEW</span><strong>1214 W Shore Dr</strong></div>
              <span className="pill pill-mint">Look First</span>
            </div>
            <div className={styles.previewMetrics}>
              <div><span>Property score</span><strong>82</strong></div>
              <div><span>Max bid</span><strong>$106,961</strong></div>
              <div><span>Headroom</span><strong>22%</strong></div>
              <div><span>Deal Truth</span><strong>74</strong></div>
            </div>
            <div className={styles.previewSignal}>
              <span>Why it matters</span>
              <strong>Good economics do not remove title, lien, occupancy, or comp verification.</strong>
            </div>
          </div>
          <div className={styles.previewFlow}>
            <WorkflowDiagram />
          </div>
        </div>
      </section>

      <section id="how" className={`container ${styles.section}`}>
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>A clearer investor workflow</p>
          <h2 className={styles.h2}>From raw list to bid decision.</h2>
          <p className={styles.sectionLead}>Instead of stitching together spreadsheets, calculators and a generic AI chat, FirstLook keeps the investment decision in one connected workflow.</p>
        </div>

        <div className={styles.stepGrid}>
          <article className="panel">
            <span className={styles.stepNo}>01</span>
            <h3>Upload the sale list</h3>
            <p className="muted">Bring the county CSV. FirstLook validates jurisdiction and property inputs before research begins.</p>
          </article>
          <article className="panel">
            <span className={styles.stepNo}>02</span>
            <h3>Apply your Buy Box</h3>
            <p className="muted">Control score thresholds, equity spread, cry-out limits, bid headroom, vacant-land and investor-owner rules.</p>
          </article>
          <article className="panel">
            <span className={styles.stepNo}>03</span>
            <h3>Underwrite the deal</h3>
            <p className="muted">Model Flip, Rental and BRRRR scenarios with rehab, financing, reserves, MAO, DSCR and downside stress.</p>
          </article>
          <article className="panel">
            <span className={styles.stepNo}>04</span>
            <h3>Verify before you bid</h3>
            <p className="muted">Use Property 360, Evidence Ledger, diligence and Copilot to see what is known and what still needs proof.</p>
          </article>
        </div>
      </section>

      <section id="why" className={`${styles.darkBand}`}>
        <div className={`container ${styles.darkInner}`}>
          <div>
            <p className={styles.darkKicker}>Why this is different</p>
            <h2>Most tools give you more property data. FirstLook is built around the decision.</h2>
          </div>
          <div className={styles.differenceGrid}>
            <div><strong>Deterministic underwriting</strong><span>Core financial outputs are calculated by tested engine logic, not generated by AI.</span></div>
            <div><strong>Evidence-aware workflow</strong><span>Assessment data, sold comps, user assumptions and unresolved evidence stay visibly distinct.</span></div>
            <div><strong>Bid discipline first</strong><span>Look First requires more than a high score — it must fit the Buy Box and retain modeled bid headroom.</span></div>
            <div><strong>Context-aware Copilot</strong><span>Ask about the exact property, comps, rehab, financing, diligence, pipeline and assumptions currently on screen.</span></div>
          </div>
        </div>
      </section>

      <section id="demo" className={`container ${styles.section}`}>
        <div className={styles.demoGrid}>
          <div>
            <p className={styles.kicker}>The client demo</p>
            <h2 className={styles.h2}>Five minutes. One property. The whole decision story.</h2>
            <p className={styles.sectionLead}>A prospect does not need a tour of every button. Show one investment moving from list → shortlist → underwriting → evidence → bid decision.</p>
            <ol className={styles.demoSteps}>
              <li><b>1.</b><span><strong>Upload a tax-sale list</strong><small>Show the raw opportunity set.</small></span></li>
              <li><b>2.</b><span><strong>Open a Look First deal</strong><small>Explain why it passed the investor’s rules.</small></span></li>
              <li><b>3.</b><span><strong>Run the economics</strong><small>Flip / Rental / BRRRR, MAO, cash flow and stress case.</small></span></li>
              <li><b>4.</b><span><strong>Open the Evidence Ledger</strong><small>Show what is fact, estimate, assumption or still unresolved.</small></span></li>
              <li><b>5.</b><span><strong>Ask Copilot “What could kill this deal?”</strong><small>Finish with the next verification action.</small></span></li>
            </ol>
            <div className={styles.ctaRow}>
              <Link href="/app" className="btn btn-primary">Start live demo</Link>
              <a href="/api/export" className="btn btn-ghost">Download sample CSV template</a>
            </div>
          </div>

          <div className={styles.demoVisual}>
            <SparkBars values={sampleNoiseCut} label="Research funnel · illustrative demo" />
            <div className={styles.quoteCard}>
              <span>POSITIONING</span>
              <strong>“Most real-estate tools give investors data. FirstLook helps them decide what to do with that data — and when not to bid.”</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.fitGrid}>
          <article className="panel"><span className={styles.stepNo}>INVESTORS</span><h3>Individual buyers</h3><p className="muted">Screen more properties without losing bid discipline or evidence context.</p></article>
          <article className="panel"><span className={styles.stepNo}>TEAMS</span><h3>Acquisition teams</h3><p className="muted">Create a repeatable underwriting and diligence workflow around the same Buy Box.</p></article>
          <article className="panel"><span className={styles.stepNo}>OPERATORS</span><h3>Tax-sale businesses</h3><p className="muted">Use the platform as the operating layer between incoming lists, research, underwriting and pipeline.</p></article>
        </div>
      </section>

      <section className={`container ${styles.finalCta}`}>
        <div>
          <p className={styles.kicker}>See the product, not a slide deck</p>
          <h2>Bring a list. FirstLook will show you what deserves a second look.</h2>
        </div>
        <Link href="/app" className="btn btn-primary">Open FirstLook</Link>
      </section>

      <footer className={`container ${styles.footer}`}>
        <div className={styles.brand}>FirstLook</div>
        <p className="muted">Real estate decision support for disciplined tax-sale underwriting.</p>
      </footer>
    </main>
  );
}
