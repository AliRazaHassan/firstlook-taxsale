import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.gridBg} aria-hidden />

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
          PropStream sells data. FastLien sells lists. Investors still overbid.
          FirstLook is the employee that ranks the official county list and locks a walk-away max bid
          before auction adrenaline hits.
        </p>
        <div className={`${styles.ctaRow} rise-3`}>
          <Link href="/app" className="btn btn-primary">
            Run live demo
          </Link>
          <a href="/api/export" className="btn btn-ghost">
            Download CSV template
          </a>
        </div>
      </section>

      <section id="gap" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>What the market is missing</h2>
        <div className={styles.gapGrid}>
          <article className="panel">
            <h3>PropStream · ~$99/mo</h3>
            <p className="muted">
              Broad lead machine. Tax delinquency is one filter. Built for outreach — not auction-day
              bid ceilings on an official sale list.
            </p>
          </article>
          <article className="panel">
            <h3>FastLien · ~$49/mo</h3>
            <p className="muted">
              Aggregates upcoming sale lists. Still leaves ranking, diligence, and overbid discipline
              mostly on you.
            </p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>FirstLook gap</h3>
            <p className="muted">
              Upload the county’s own list → look-first shortlist → hard max bid → county rule pack →
              diligence checklist → auction bid sheet. That is the half of the job that loses money.
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
              Valuation confidence, county rule packs, diligence checklist, auction bid sheet with
              walk-away ceiling.
            </p>
          </article>
          <article className="panel">
            <span className="tag tag-map">Live stub</span>
            <h3>Phase 4 — Don’t miss the next sale</h3>
            <p className="muted">County watch registration → path to automated new-list alerts.</p>
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
