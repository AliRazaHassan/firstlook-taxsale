import Link from "next/link";
import styles from "./page.module.css";

const PHASES = [
  {
    phase: "Phase 1",
    problem: "The whole list looks urgent",
    solves: "Ranks which parcels to chase first",
    half: "Cuts noise. You stop researching every junk lot.",
    status: "Live now",
    live: true,
  },
  {
    phase: "Phase 2",
    problem: "Scores don’t match how YOU buy",
    solves: "Your buy box + max bid + bigger lists",
    half: "Turns FirstLook into your weekly diligence tool.",
    status: "Live now",
    live: true,
  },
  {
    phase: "Phase 3",
    problem: "Values feel like guesses",
    solves: "Comps / AVM-grade market ranges",
    half: "You trust the ranking enough for drive-bys.",
    status: "Next",
    live: false,
  },
  {
    phase: "Phase 4+",
    problem: "You still miss new sales & title traps",
    solves: "Monitoring + risk flags + deal tracker",
    half: "A permanent tax-sale research employee.",
    status: "Roadmap",
    live: false,
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.gridGlow} aria-hidden />

      <header className={`container ${styles.nav}`}>
        <div className={styles.brand}>FirstLook</div>
        <nav className={styles.navLinks}>
          <a href="#problem">The problem</a>
          <a href="#phases">Phases</a>
          <a href="#pricing">Pricing</a>
          <Link href="/app" className="btn btn-primary">
            Open app
          </Link>
        </nav>
      </header>

      <section className={`container ${styles.hero}`}>
        <p className={`${styles.kicker} rise`}>Tax-sale AI employee</p>
        <h1 className={`${styles.logoHero} rise-2`}>FirstLook</h1>
        <p className={`${styles.sub} rise-3`}>
          Tax-sale lists burn half your week. FirstLook solves that half first — so you only chase
          the parcels worth your time.
        </p>
        <div className={`${styles.ctaRow} rise-3`}>
          <Link href="/app" className="btn btn-primary">
            See it cut a real list
          </Link>
          <a href="#phases" className="btn btn-ghost">
            How each phase helps you
          </a>
        </div>
      </section>

      <section id="problem" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Half the job is knowing what to ignore</h2>
        <div className={styles.painGrid}>
          <article className="panel">
            <h3>Before FirstLook</h3>
            <p className="muted">
              100–300 parcels. Random Zillow tabs. Missed red flags. Overbids. Hours gone before you
              even pick a drive-by.
            </p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>With FirstLook</h3>
            <p className="muted">
              Ranked “look first” shortlist, red flags, research links, and max bid — in one sheet.
              That is the half of the problem that blocks every deal.
            </p>
          </article>
        </div>
      </section>

      <section id="phases" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Each phase solves a real investor problem</h2>
        <p className={`muted ${styles.phaseIntro}`}>
          We don’t ship features for vanity. Every phase removes a pain that currently costs you
          time, money, or a bad bid.
        </p>
        <div className={styles.phaseList}>
          {PHASES.map((p) => (
            <article key={p.phase} className={`panel ${styles.phaseCard}`}>
              <div className={styles.phaseTop}>
                <span className={p.live ? "pill pill-mint" : "pill pill-fog"}>{p.status}</span>
                <strong>{p.phase}</strong>
              </div>
              <h3>{p.solves}</h3>
              <p className={styles.problemLine}>
                <span>Problem:</span> {p.problem}
              </p>
              <p className="muted">{p.half}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={`${styles.proof} panel`}>
          <div>
            <h2 className={styles.h2}>Already cutting a real county list</h2>
            <p className="muted">
              Clayton County, GA tax-sale sample: 27 parcels in → 5 look-first picks out. That is
              ~80% of the list you can stop wasting diligence on.
            </p>
          </div>
          <div className={styles.stats}>
            <div>
              <strong>27</strong>
              <span>in</span>
            </div>
            <div>
              <strong>5</strong>
              <span>chase</span>
            </div>
            <div>
              <strong>~80%</strong>
              <span>noise cut</span>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Buy the problem you want solved next</h2>
        <div className={styles.pricing}>
          <article className="panel">
            <h3>Phase 1 proof</h3>
            <p className={styles.price}>$125</p>
            <p className="muted">Your list · ranked sheet · look-first shortlist</p>
          </article>
          <article className={`panel ${styles.featured}`}>
            <h3>Phase 2 weekly tool</h3>
            <p className={styles.price}>$149/mo</p>
            <p className="muted">Your buy box · max bid · bigger lists · Sheets export</p>
          </article>
        </div>
        <p className={`muted ${styles.phaseIntro}`}>
          Phase 3+ (comps, monitoring, title risk) unlocks after Phase 2 is saving you every week.
        </p>
      </section>

      <footer className={`container ${styles.footer}`}>
        <div className={styles.brand}>FirstLook</div>
        <p className="muted">Built to solve half the tax-sale problem first — then the rest.</p>
      </footer>
    </main>
  );
}
