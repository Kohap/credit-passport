import Link from "next/link";

const SECTIONS = [
  {
    title:
      "A repayment on Ethereum is invisible to Creditcoin unless someone is allowed to lie.",
    body: "Cross-chain credit today trusts bridges, oracles, or backends. Credit Passport refuses \u201cindexer says repaid.\u201d MockMarket on Sepolia is the fixture. The Attestcoin path is live.",
  },
  {
    title: "Verification and underwriting share one Creditcoin transaction.",
    body: "Precompile 0x\u20260FD2 verifyAndEmit. The ASC requires receiptStatus == 1 (the precompile does not). Emitter, borrower, and replay key are checked on-chain. Score, cap, and the soulbound Passport write in that same call.",
  },
  {
    title: "One holder. One path. On-chain.",
    body: "Open and repay on Sepolia. Wait until the height is attested. proveRepayment. Score 0 \u2192 50, cap 200 mUSD, soulbound PASS #1. If the line is funded, borrow 10 mUSD.",
  },
  {
    title: "Signal on Sepolia. Standing on Creditcoin.",
    body: "ProofBuilder returns Merkle + continuity. CreditPassportASC is the only writer of score, cap, and NFT. The verified v2 repayment is live; the source remains a MockMarket fixture.",
  },
  {
    title: "Execution history for agents uses the same primitive.",
    body: "A distinct client wallet funded and approved a Sepolia job escrow. Attestcoin proved the payment release on Creditcoin, where Agent Passport #1 now records one completed job and 1 mUSD settled volume.",
  },
];

export default function DossierPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          Credit Passport
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <Link href="/dossier">Dossier</Link>
          <Link href="/app">Open Desk</Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-section landing-problem">
          <p className="section-kicker">Dossier</p>
          <h1 className="landing-headline">Credit that does not wait on an oracle.</h1>
          <p>
            How a repayment on Ethereum becomes standing on Creditcoin \u2014 verified, written,
            and held.
          </p>
        </section>

        {SECTIONS.map((section) => (
          <section className="landing-section" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <p>Credit Passport \u00b7 Creditcoin CC3</p>
          <p className="landing-footer-meta">Attestcoin verifyAndEmit at 0xFD2</p>
        </div>
      </footer>
    </div>
  );
}
