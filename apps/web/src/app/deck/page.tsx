"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  {
    kicker: "Credit Passport",
    title: "Credit that moves with you.",
    body: "A verified repayment becomes a credit record you can keep using across networks.",
  },
  {
    kicker: "The problem",
    title: "Good repayment history gets left behind.",
    body: "Today, paying a loan on one network does not automatically help you on another.",
  },
  {
    kicker: "The check",
    title: "Your repayment is checked before it counts.",
    body: "Credit Passport verifies that the payment really happened instead of relying on a manual approval.",
  },
  {
    kicker: "The result",
    title: "One repayment can update your record.",
    body: "When verification completes, your score, Passport, and demo borrowing limit update together.",
  },
  {
    kicker: "The path",
    title: "Try a loan. Repay it. Verify it.",
    body: "The demo uses test funds and guides you through every step with the same wallet.",
  },
  {
    kicker: "The record",
    title: "The full path has already been proven live.",
    body: "A demo repayment has created a Credit Passport and a new demo borrowing limit on testnet.",
  },
  {
    kicker: "The extension",
    title: "The same idea can recognise agent work.",
    body: "A client funds a job, confirms delivery, and the agent builds a portable history of paid work.",
  },
  {
    kicker: "The product",
    title: "One product, two kinds of progress.",
    body: "People carry repayment history. Agents carry a history of work that clients paid for.",
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
              Try the credit demo
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
