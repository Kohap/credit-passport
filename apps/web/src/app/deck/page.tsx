"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  {
    kicker: "Credit Passport",
    title: "Credit that does not wait on an oracle.",
    body: "A repayment on Ethereum becomes standing on Creditcoin — verified, written, and held.",
  },
  {
    kicker: "The problem",
    title: "A repayment on Ethereum is invisible to Creditcoin unless someone is allowed to lie.",
    body: "Bridges, oracles, and indexers sit in the middle. Credit Passport refuses “indexer says repaid.”",
  },
  {
    kicker: "The check",
    title: "Attestcoin reads the foreign transaction itself.",
    body: "verifyAndEmit at 0xFD2 must return true. Receipt must succeed. Emitter must be our MockMarket.",
  },
  {
    kicker: "The write",
    title: "Score, passport, and borrow cap share one transaction.",
    body: "No second operator. No delayed mint. The soulbound PASS is the underwriting record.",
  },
  {
    kicker: "The path",
    title: "Repay. Attest. Prove.",
    body: "Sepolia MockMarket emits LoanRepaid. Wait until the height is attested. Submit on Creditcoin CC3.",
  },
  {
    kicker: "The record",
    title: "Already run. Score 50. Passport #1. Cap 200 mUSD.",
    body: "One EOA on Sepolia and Creditcoin. First closed loan, live on CC3 testnet.",
  },
  {
    kicker: "The product",
    title: "The desk is the product.",
    body: "Replay the recorded proof, or connect the same wallet and run the path yourself.",
  },
] as const;

export default function DeckPage() {
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;
  const slide = SLIDES[index];

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(last, next))),
    [last],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(index + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <main className="desk" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="desk-top">
        <Link href="/" className="desk-home">
          Credit Passport
        </Link>
        <p className="desk-meta" style={{ margin: 0 }}>
          {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </p>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 0" }}>
        <p className="desk-meta">{slide.kicker}</p>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 5vw, 3.4rem)", letterSpacing: "-0.03em", lineHeight: 1.15, maxWidth: "18ch" }}>
          {slide.title}
        </h1>
        <p style={{ color: "var(--mute)", maxWidth: "36rem", fontSize: "1.05rem" }}>{slide.body}</p>
        {index === last ? (
          <div className="hero-actions" style={{ marginTop: "1.25rem" }}>
            <Link href="/app" className="btn btn-primary">
              Open Desk
            </Link>
          </div>
        ) : null}
      </div>
      <div className="hero-actions" style={{ paddingBottom: "1.5rem" }}>
        {SLIDES.map((item, i) => (
          <button
            key={item.kicker}
            type="button"
            className="btn btn-ghost"
            onClick={() => go(i)}
            aria-current={i === index ? "true" : undefined}
          >
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
    </main>
  );
}
