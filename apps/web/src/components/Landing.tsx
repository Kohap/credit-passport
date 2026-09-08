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

const OUTCOMES = [
  {
    title: "Keep the proof",
    body: "Your verified repayment becomes a record linked to the wallet that earned it.",
  },
  {
    title: "See your progress",
    body: "A clear record shows what you have repaid and what you can try next.",
  },
  {
    title: "Carry it forward",
    body: "The record is yours to share with a future credit experience or agent workflow.",
  },
] as const;

const STARTING_POINTS = [
  {
    number: "01",
    title: "Try the credit demo",
    body: "Borrow demo funds, repay them, then watch your record update.",
    href: "/app",
    action: "Start credit demo",
  },
  {
    number: "02",
    title: "Understand the journey",
    body: "See the simple path from a repayment to a portable credit record.",
    href: "/dossier",
    action: "See the journey",
  },
  {
    number: "03",
    title: "Give an agent a record",
    body: "Record client-approved work and give an agent a reputation it can carry.",
    href: "/agent",
    action: "Open Agent Passport",
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

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

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
          <div className="landing-menu-sheet-head">
            <Link href="/app" className="landing-menu-desk" onClick={closeMenu}>
              Open Desk
            </Link>
            <button type="button" className="landing-menu-close" onClick={closeMenu}>
              Close
            </button>
          </div>
          <a href="#product" className="landing-nav-strong" onClick={closeMenu}>
            Product
          </a>
          <Link href="/agent" className="landing-nav-strong" onClick={closeMenu}>
            Agent Passport
          </Link>
          <a href="#builders" className="landing-nav-optional" onClick={closeMenu}>
            Builders
          </a>
          <a href="#legal" className="landing-nav-strong" onClick={closeMenu}>
            Legal
          </a>
          <Link href="/app" className="landing-nav-strong landing-nav-desktop-desk" onClick={closeMenu}>
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
          <div className="landing-hero-aside">
            <p className="landing-kicker" id="landing-brand">
              Credit Passport <span>Testnet demo</span>
            </p>
            <h1 className="landing-headline">
              Credit history you can carry.
            </h1>
            <p className="landing-lede">
              Turn a repaid demo loan into a record that stays with your wallet, ready for the
              next opportunity.
            </p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-primary landing-cta">
                Start credit demo
              </Link>
              <Link href="/dossier" className="btn btn-ghost landing-cta">
                See how it works
              </Link>
            </div>
          </div>
          <aside className="landing-record" aria-label="Example Credit Passport record">
            <div className="landing-record-topline">
              <span>Your Passport</span>
              <span>Ready to earn</span>
            </div>
            <p className="landing-record-title">A record of good follow-through.</p>
            <dl className="landing-record-stats">
              <div>
                <dt>Repayments</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Credit record</dt>
                <dd>Waiting</dd>
              </div>
            </dl>
            <p className="landing-record-note">
              Complete the demo and this becomes a record you can keep in your wallet.
            </p>
          </aside>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-section landing-problem" id="product" aria-labelledby="product-title">
          <p className="landing-eyebrow">A record with you</p>
          <h2 id="product-title">Good repayment should not get left behind.</h2>
          <p>
            Credit Passport gives your repayment a place to count. Complete a safe test demo,
            verify it, and keep a credit record with the wallet that did the work.
          </p>
          <ul className="landing-list">
            {OUTCOMES.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section landing-start" aria-labelledby="start-title">
          <div className="landing-section-intro">
            <p className="landing-eyebrow">Start where you are</p>
            <h2 id="start-title">One product, three clear ways in.</h2>
          </div>
          <div className="landing-routes">
            {STARTING_POINTS.map((point) => (
              <article key={point.title} className="landing-route">
                <span>{point.number}</span>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
                <Link href={point.href}>{point.action}</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-how" aria-labelledby="how-title">
          <p className="landing-eyebrow">The credit path</p>
          <h2 id="how-title">A simple action. A lasting record.</h2>
          <ol className="landing-steps">
            <li>
              <h3>Repay a demo loan</h3>
              <p>Use test funds only. There is no real money involved.</p>
            </li>
            <li>
              <h3>Let the repayment be checked</h3>
              <p>The app confirms that the repayment happened before it updates your record.</p>
            </li>
            <li>
              <h3>Keep the record</h3>
              <p>Your Passport appears in the wallet that made the repayment, ready for the next demo.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section" id="builders" aria-labelledby="builders-title">
          <p className="landing-eyebrow">For builders</p>
          <h2 id="builders-title">Let an assistant read the record, not control the wallet.</h2>
          <p>
            Credit Passport now has a read-only MCP endpoint. An assistant can inspect public
            testnet records and guide someone to the right next screen, while wallet approvals
            stay with the person who owns the wallet.
          </p>
          <p className="landing-links">
            <Link href="/docs#mcp">Read the MCP guide</Link>
            <Link href="/agent">Open Agent Passport</Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              View the source code
            </a>
          </p>
        </section>

        <section className="landing-section" id="legal" aria-labelledby="legal-title">
          <p className="landing-eyebrow">Before you begin</p>
          <h2 id="legal-title">A safe place to try the full flow.</h2>
          <p>
            Credit Passport is a public testnet demo. Its demo funds have no market value, it
            does not provide real-world credit, and you remain in control of your wallet.
          </p>
          <Link href="/docs" className="landing-inline-link">Read the demo and privacy details</Link>
        </section>
      </main>

      <section className="landing-close" aria-labelledby="close-title">
        <div className="landing-close-visual" aria-hidden="true" />
        <div className="landing-close-copy">
          <h2 id="close-title">Turn repayment into opportunity</h2>
          <p>
            Start a simple demo and see a repayment become a record you keep.
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
            <a href="#builders">Builders</a>
            <a href="#legal">Legal</a>
            <Link href="/docs">Docs</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
