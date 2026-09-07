import Link from "next/link";
import {
  ATTESTOR_DASHBOARD,
  CREDITCOIN_CHAIN_ID,
  PROOF_BUILDER_URL,
  SCORE_FORMULA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_KEY,
  addresses,
} from "@/config/networks";

export default function DocsPage() {
  return (
    <main className="desk">
      <header className="desk-top">
        <div className="desk-top-brand">
          <Link href="/" className="desk-home">
            Credit Passport
          </Link>
          <p className="desk-top-lede">
            How to run Credit Passport on Sepolia and Creditcoin CC3.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/app" className="btn btn-primary">
            Open Desk
          </Link>
        </div>
      </header>

      <h1 className="section h2" style={{ fontFamily: "var(--serif)", fontSize: "2.4rem", letterSpacing: "-0.03em" }}>
        Docs
      </h1>
      <p>
        Same wallet on both chains. No oracle operator. Faucet → open → repay on
        Sepolia, then prove on Creditcoin.
      </p>

      <section className="section">
        <h2>Networks</h2>
        <dl className="kv">
          <dt>Sepolia</dt>
          <dd>{SEPOLIA_CHAIN_ID}</dd>
          <dt>Creditcoin CC3</dt>
          <dd>{CREDITCOIN_CHAIN_ID}</dd>
          <dt>chainKey</dt>
          <dd>{SEPOLIA_CHAIN_KEY} (not chainId)</dd>
          <dt>verifyAndEmit</dt>
          <dd>0x0000000000000000000000000000000000000FD2</dd>
        </dl>
      </section>

      <section className="section">
        <h2>Path</h2>
        <ol>
          <li>Repay on Sepolia MockMarket (LoanRepaid).</li>
          <li>Wait until Attestcoin attests that height.</li>
          <li>Submit Merkle + continuity via proveRepayment.</li>
          <li>Score, cap, and soulbound passport write in that same transaction.</li>
        </ol>
      </section>

      <section className="section">
        <h2>Contracts</h2>
        <dl className="kv">
          <dt>MockUSD</dt>
          <dd>{addresses.sepoliaMockUsd}</dd>
          <dt>MockMarket</dt>
          <dd>{addresses.sepoliaMockMarket}</dd>
          <dt>CreditPassportASC</dt>
          <dd>{addresses.creditPassportAsc}</dd>
          <dt>PassportNFT</dt>
          <dd>{addresses.passportNft}</dd>
        </dl>
      </section>

      <section className="section">
        <h2>Score</h2>
        <ul>
          {SCORE_FORMULA.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="footnote">
        ProofBuilder {PROOF_BUILDER_URL.replace("https://", "")}. Attestors:{" "}
        <a href={ATTESTOR_DASHBOARD} target="_blank" rel="noreferrer">
          dashboard
        </a>
        . Slide version: <Link href="/deck">Deck</Link>.
      </p>
    </main>
  );
}
