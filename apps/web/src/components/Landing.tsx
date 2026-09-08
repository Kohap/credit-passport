"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";

const REPO = "https://github.com/Kohap/credit-passport";

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

function ThemeMark({ theme }: { theme: LandingTheme }) {
  const toLight = theme === "dark";
  return (
    <svg
      className="landing-theme-mark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#4A1C28" />
      <rect width="5" height="32" fill="#0E1116" opacity="0.32" />
      {toLight ? (
        <>
          <circle cx="17.5" cy="16" r="4.4" fill="#D6CBB8" />
          <g stroke="#D6CBB8" strokeWidth="1.6" strokeLinecap="round">
            <path d="M17.5 6.8v2.2" />
            <path d="M17.5 23v2.2" />
            <path d="M8.3 16h2.2" />
            <path d="M24.5 16h2.2" />
            <path d="M11 9.6l1.6 1.6" />
            <path d="M22.4 20.8l1.6 1.6" />
            <path d="M11 22.4l1.6-1.6" />
            <path d="M22.4 11.2l1.6-1.6" />
          </g>
        </>
      ) : (
        <>
          <circle cx="17.2" cy="16" r="6.1" fill="#D6CBB8" />
          <circle cx="21.2" cy="13.4" r="5.1" fill="#4A1C28" />
        </>
      )}
    </svg>
  );
}

const INSTRUMENTS = [
  {
    title: "Passport",
    body: "A personal credit record that stays with the wallet that earned it.",
  },
  {
    title: "Progress",
    body: "Each verified repayment strengthens your test credit record.",
  },
  {
    title: "Opportunity",
    body: "A verified record can unlock a larger demo borrowing limit.",
  },
] as const;

const FAQ = [
  {
    q: "What does Credit Passport issue?",
    a: "A personal, non-transferable credit record, a repayment score, and a demo borrowing limit after a repayment is verified.",
  },
  {
    q: "Is this a bureau or a lender?",
    a: "No. It is on-chain software. It does not collect KYC, does not report to a credit bureau, and does not extend fiat credit.",
  },
  {
    q: "What is live, and what is a fixture?",
    a: "The verification path is live on testnet. The current loan and currency are demos so you can safely try the full experience.",
  },
  {
    q: "Who can change a score?",
    a: "Only a verified repayment can update it. No person at Credit Passport manually approves a score.",
  },
  {
    q: "What data is stored?",
    a: "Wallet addresses, proofs, score, cap, and token id live on public testnets. Credit Passport does not collect names, emails, or off-chain identity.",
  },
  {
    q: "Can the passport be transferred?",
    a: "No. It is soulbound to the proving wallet.",
  },
  {
    q: "Which networks?",
    a: "The demo starts on Ethereum Sepolia and creates the record on Creditcoin CC3. Technical network details are in Docs.",
  },
] as const;


type LandingTheme = "light" | "dark";
const THEME_KEY = "cp-landing-theme";

function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>("dark");

  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  function toggle() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  return { theme, toggle };
}

export function Landing() {
  const { theme, toggle } = useLandingTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="landing" data-theme={theme}>
      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          <StampMark />
          Credit Passport
        </Link>
        <nav className="landing-nav-links" id="landing-primary-menu" data-open={menuOpen} aria-label="Primary">
          <a href="#product" className="landing-nav-strong" onClick={closeMenu}>
            Product
          </a>
          <Link href="/agent" className="landing-nav-strong" onClick={closeMenu}>
            Agent Passport
          </Link>
          <a href="#developers" className="landing-nav-optional" onClick={closeMenu}>
            Developers
          </a>
          <a href="#legal" className="landing-nav-strong" onClick={closeMenu}>
            Legal
          </a>
          <Link href="/app" className="landing-nav-strong" onClick={closeMenu}>
            Open Desk
          </Link>
        </nav>
        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <ThemeMark theme={theme} />
          </button>
          <button
            type="button"
            className="landing-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="landing-primary-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero-visual" aria-hidden="true" />
        <div className="landing-hero-stage">
          <p className="landing-brand" id="landing-brand">
            Credit Passport
          </p>
          <div className="landing-hero-aside">
            <h1 className="landing-headline">
              Turn a repaid loan into credit you can carry.
            </h1>
            <p className="landing-lede">
              Repay a demo loan, verify it, and keep the credit record in your wallet.
            </p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-primary landing-cta">
                Try the credit demo
              </Link>
              <Link href="/dossier" className="btn btn-ghost landing-cta">
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-section landing-problem" id="product" aria-labelledby="product-title">
          <h2 id="product-title">Credit should travel with the borrower</h2>
          <p>
            A repayment should not disappear when you move between networks. Credit Passport
            turns a verified repayment into a credit record that stays with your wallet.
          </p>
          <ul className="landing-list">
            {INSTRUMENTS.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol className="landing-steps">
            <li>
              <h3>Try a demo loan</h3>
              <p>Get test funds, open a small demo loan, and repay it. No real money is involved.</p>
            </li>
            <li>
              <h3>Verify your repayment</h3>
              <p>Credit Passport checks the repayment and adds it to your record.</p>
            </li>
            <li>
              <h3>See your credit</h3>
              <p>Your Passport and demo borrowing limit appear when verification is complete.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section" id="developers" aria-labelledby="developers-title">
          <h2 id="developers-title">Built for builders</h2>
          <p>
            The contracts, testnet deployments, architecture, and integration guide are public.
            Start with the documentation when you want to connect your own repayment source.
          </p>
          <p className="landing-links">
            <Link href="/docs">Read the technical docs</Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              View the source code
            </a>
          </p>
        </section>

        <section className="landing-section" id="legal" aria-labelledby="legal-title">
          <h2 id="legal-title">Legal</h2>
          <p>
            Credit Passport is software on public testnets. MockUSD has no market value.
            Use of the desk is at your own risk and does not create a lending relationship.
          </p>
          <div className="landing-faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="landing-legal-note">
            <p>
              Not an offer of credit, a security, or investment advice. No warranty, express
              or implied. Figures on the desk are testnet records. Review the published
              contracts before relying on any score, cap, or passport.
            </p>
            <p>
              On-chain activity is public. Connecting a wallet reveals that address to the
              network and to the desk interface. We do not sell personal data because we
              do not collect it off-chain.
            </p>
          </div>
        </section>
      </main>

      <section className="landing-close" aria-labelledby="close-title">
        <div className="landing-close-visual" aria-hidden="true" />
        <div className="landing-close-copy">
          <h2 id="close-title">Turn repayment into opportunity</h2>
          <p>
            See how a verified repayment can become a portable credit record.
          </p>
          <Link href="/app" className="btn btn-primary landing-cta">
            Start the demo
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <p>Credit Passport · Creditcoin CC3</p>
          <p className="landing-footer-links">
            <a href="#product">Product</a>
            <a href="#developers">Developers</a>
            <a href="#legal">Legal</a>
            <Link href="/docs">Docs</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
