import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.gridGlow} aria-hidden />

      <header className={`container ${styles.nav}`}>
        <div className={styles.brand}>FirstLook</div>
        <nav className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/app" className="btn btn-primary">
            Open app
          </Link>
        </nav>
      </header>

      <section className={`container ${styles.hero}`}>
        <p className={`${styles.kicker} rise`}>Tax-sale research employee</p>
        <h1 className={`${styles.logoHero} rise-2`}>FirstLook</h1>
        <p className={`${styles.sub} rise-3`}>
          Out of this tax-sale list, which properties should you look at first?
        </p>
        <div className={`${styles.ctaRow} rise-3`}>
          <Link href="/app" className="btn btn-primary">
            Run Clayton County demo
          </Link>
          <a href="#how" className="btn btn-ghost">
            See the workflow
          </a>
        </div>
      </section>

      <section id="how" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>One job. Usable sheet. No chatbot theater.</h2>
        <div className={styles.steps}>
          <article className="panel">
            <span>01</span>
            <h3>Upload county list</h3>
            <p>CSV with parcel, owner, address, FMV, cry-out bid.</p>
          </article>
          <article className="panel">
            <span>02</span>
            <h3>Research + score</h3>
            <p>Census geocode, ACS neighborhood value, buy-box ranking, red flags.</p>
          </article>
          <article className="panel">
            <span>03</span>
            <h3>Chase the top 5</h3>
            <p>Assessor / Zillow / Redfin / Regrid / Maps links + max-bid estimate.</p>
          </article>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={`${styles.proof} panel`}>
          <div>
            <h2 className={styles.h2}>Already proven on a real list</h2>
            <p className="muted">
              Clayton County, GA — July 2026 tax sale sample. 27 parcels researched. Top picks ranked
              for diligence first.
            </p>
          </div>
          <div className={styles.stats}>
            <div>
              <strong>27</strong>
              <span>parcels</span>
            </div>
            <div>
              <strong>20</strong>
              <span>geocoded</span>
            </div>
            <div>
              <strong>5</strong>
              <span>look-first</span>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Simple Phase-1 pricing</h2>
        <div className={styles.pricing}>
          <article className="panel">
            <h3>Prototype</h3>
            <p className={styles.price}>$125</p>
            <p className="muted">One county list · 20–30 properties · ranked sheet</p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>Monthly AI employee</h3>
            <p className={styles.price}>$149/mo</p>
            <p className="muted">Ongoing lists · buy-box tuning · max-bid + export</p>
          </article>
        </div>
      </section>

      <footer className={`container ${styles.footer}`}>
        <div className={styles.brand}>FirstLook</div>
        <p className="muted">Built for investors who buy tax-sale paper, not chatbots.</p>
      </footer>
    </main>
  );
}
