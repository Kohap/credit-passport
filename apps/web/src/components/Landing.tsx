import Link from "next/link";

function StampMark() {
  return (
    <svg
      className="landing-mark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#4A1C28" />
      <rect width="5" height="32" fill="#0E1116" opacity="0.32" />
      <circle cx="18.5" cy="12.5" r="5.2" fill="none" stroke="#D6CBB8" strokeWidth="1.9" />
      <circle cx="18.5" cy="12.5" r="1.6" fill="#D6CBB8" />
      <rect x="9" y="21" width="17" height="2.3" rx="1.15" fill="#D6CBB8" />
      <rect x="11" y="25.2" width="13" height="1.8" rx="0.9" fill="#D6CBB8" opacity="0.62" />
    </svg>
  );
}

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          <StampMark />
          Credit Passport
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <Link href="/dossier">Dossier</Link>
          <Link href="/app">Open Desk</Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero-visual" aria-hidden="true" />
        <div className="landing-hero-stage">
          <p className="landing-brand" id="landing-brand">
            Credit Passport
          </p>
          <div className="landing-hero-aside">
            <h1 className="landing-headline">
              A repayment on Ethereum becomes credit on Creditcoin.
            </h1>
            <p className="landing-lede">
              Attestcoin checks LoanRepaid inclusion on-chain. Same wallet. No oracle
              operator.
            </p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-primary landing-cta">
                Open Desk
              </Link>
              <Link href="/dossier" className="btn btn-ghost landing-cta">
                Read the dossier
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-section landing-problem" aria-labelledby="problem-title">
          <h2 id="problem-title">Credit should travel with the borrower</h2>
          <p>
            A repayment on Ethereum does not automatically count on Creditcoin. Oracles put
            trust back in the middle. Credit Passport uses Attestcoin so a proven repayment
            can raise score, mint a soulbound Passport, and open a CreditLine.
          </p>
        </section>

        <section className="landing-section" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol className="landing-steps">
            <li>
              <h3>Repay on Sepolia</h3>
              <p>Faucet mUSD, open a mock loan, repay so MockMarket emits LoanRepaid.</p>
            </li>
            <li>
              <h3>Prove with Attestcoin</h3>
              <p>Wait for height attestation, build the inclusion proof, submit on Creditcoin.</p>
            </li>
            <li>
              <h3>Unlock credit</h3>
              <p>Score updates, Passport mints, and you can borrow against the CreditLine.</p>
            </li>
          </ol>
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <div className="landing-close-visual" aria-hidden="true" />
          <div className="landing-close-copy">
            <h2 id="close-title">Run the Attestcoin loop</h2>
            <p>
              One MetaMask account on Sepolia and Creditcoin CC3. About ninety seconds once
              attestation is ready.
            </p>
            <Link href="/app" className="btn btn-primary landing-cta">
              Open Desk
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <p>Credit Passport · Creditcoin CC3</p>
          <p className="landing-footer-meta">
            Sepolia to Creditcoin CC3 · precompile 0x…0FD2 · chainKey 1
          </p>
        </div>
      </footer>
    </div>
  );
}
