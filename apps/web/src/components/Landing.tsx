import Link from "next/link";

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          Credit Passport
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <a href="#how">How it works</a>
          <Link href="/app" className="btn btn-primary landing-nav-cta">
            Open Desk
          </Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero-visual" aria-hidden="true">
          <svg
            className="passport-plane"
            viewBox="0 0 1200 800"
            preserveAspectRatio="xMidYMid slice"
            role="presentation"
          >
            <defs>
              <linearGradient id="pass-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1a4036" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#0e241e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#071210" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="pass-edge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.05" />
              </linearGradient>
              <radialGradient id="pass-glow" cx="70%" cy="40%" r="45%">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1200" height="800" fill="url(#pass-glow)" />
            <g className="passport-sheet" transform="translate(520 90)">
              <rect
                x="0"
                y="0"
                width="520"
                height="620"
                rx="18"
                fill="url(#pass-fill)"
                stroke="url(#pass-edge)"
                strokeWidth="2"
              />
              <rect x="36" y="48" width="180" height="180" rx="10" fill="#0a1814" stroke="#2a5648" />
              <circle cx="126" cy="120" r="36" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.7" />
              <path
                d="M90 155 Q126 190 162 155"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2"
                opacity="0.55"
              />
              <rect x="240" y="56" width="240" height="14" rx="3" fill="#2dd4bf" opacity="0.35" />
              <rect x="240" y="88" width="200" height="10" rx="3" fill="#8aa399" opacity="0.35" />
              <rect x="240" y="112" width="220" height="10" rx="3" fill="#8aa399" opacity="0.25" />
              <rect x="36" y="260" width="448" height="1" fill="#1f3a31" />
              <rect x="36" y="292" width="140" height="8" rx="2" fill="#8aa399" opacity="0.4" />
              <rect x="36" y="316" width="320" height="12" rx="2" fill="#e8f5ef" opacity="0.2" />
              <rect x="36" y="352" width="140" height="8" rx="2" fill="#8aa399" opacity="0.4" />
              <rect x="36" y="376" width="280" height="12" rx="2" fill="#e8f5ef" opacity="0.18" />
              <rect x="36" y="420" width="448" height="1" fill="#1f3a31" />
              <g opacity="0.75">
                <circle cx="80" cy="480" r="18" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
                <circle cx="80" cy="480" r="8" fill="#2dd4bf" opacity="0.4" />
                <rect x="118" y="468" width="200" height="8" rx="2" fill="#8aa399" opacity="0.45" />
                <rect x="118" y="488" width="160" height="8" rx="2" fill="#8aa399" opacity="0.3" />
              </g>
              <text
                x="36"
                y="580"
                fill="#2dd4bf"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="14"
                opacity="0.7"
              >
                ATTESTCOIN · chainKey 1
              </text>
            </g>
            <g className="proof-lines" fill="none" stroke="#2dd4bf" strokeWidth="1.2" opacity="0.35">
              <path d="M80 220 C220 180, 320 260, 480 240" />
              <path d="M60 360 C200 320, 300 400, 500 380" />
              <path d="M100 520 C240 480, 340 560, 510 540" />
            </g>
          </svg>
        </div>

        <div className="landing-hero-copy">
          <p className="landing-brand" id="landing-brand">
            Credit Passport
          </p>
          <h1 className="landing-headline">
            Prove a repayment.
            <br />
            Unlock credit on Creditcoin.
          </h1>
          <p className="landing-lede">
            Attestcoin verifies Sepolia LoanRepaid inclusion on-chain — no oracle operator, same
            wallet.
          </p>
          <div className="landing-cta-row">
            <Link href="/app" className="btn btn-primary landing-cta">
              Open Desk
            </Link>
            <a href="#how" className="btn btn-ghost">
              How it works
            </a>
          </div>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-section" aria-labelledby="problem-title">
          <h2 id="problem-title">Credit should travel with the borrower</h2>
          <p>
            Repayments on Ethereum do not automatically count on Creditcoin. Oracles and off-chain
            operators reintroduce trust. Credit Passport uses Attestcoin so a proven repayment can
            raise score, mint a soulbound Passport, and open a credit line.
          </p>
        </section>

        <section className="landing-section" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol className="landing-steps">
            <li>
              <span className="landing-step-index">01</span>
              <div>
                <h3>Repay on Sepolia</h3>
                <p>Open and repay a mock loan so MockMarket emits LoanRepaid.</p>
              </div>
            </li>
            <li>
              <span className="landing-step-index">02</span>
              <div>
                <h3>Prove with Attestcoin</h3>
                <p>Wait for height attestation, generate the inclusion proof, submit on Creditcoin.</p>
              </div>
            </li>
            <li>
              <span className="landing-step-index">03</span>
              <div>
                <h3>Unlock credit</h3>
                <p>Score updates, Passport mints, and you can borrow against the CreditLine.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <h2 id="close-title">Run the Attestcoin loop</h2>
          <p>Same MetaMask EOA on Sepolia and Creditcoin CC3. About ninety seconds when attestation is ready.</p>
          <Link href="/app" className="btn btn-primary landing-cta">
            Open Desk
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          Credit Passport · BUIDL CTC 2026 · Attestcoin on Creditcoin
        </p>
        <p className="landing-footer-meta">
          Sepolia → Creditcoin CC3 · precompile 0x…0FD2 · chainKey 1
        </p>
      </footer>
    </div>
  );
}
