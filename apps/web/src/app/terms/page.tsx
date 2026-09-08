import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="desk">
      <header className="desk-top">
        <div className="desk-top-brand">
          <Link href="/" className="desk-home">Credit Passport</Link>
          <p className="desk-top-lede">Terms and conditions for the public testnet demo.</p>
        </div>
        <Link href="/app" className="btn btn-primary">Open Desk</Link>
      </header>

      <section className="section" aria-labelledby="terms-title">
        <div className="section-head">
          <h1 id="terms-title">Terms &amp; Conditions</h1>
          <span className="section-kicker">Updated Sep 8, 2026</span>
        </div>
        <p>
          Credit Passport is an experimental public testnet demo. By using it, you agree to use it
          only for evaluation and not for real-world financial activity.
        </p>
      </section>

      <section className="section" aria-labelledby="demo-terms-title">
        <h2 id="demo-terms-title">Using the demo</h2>
        <ul>
          <li>Demo mUSD and testnet assets have no market value.</li>
          <li>The demo does not provide a real loan, credit score, or lending decision.</li>
          <li>Only connect a wallet you control. Never enter a seed phrase or private key.</li>
          <li>Testnet services, proof availability, and demo liquidity may change or be unavailable.</li>
        </ul>
      </section>

      <section className="section" aria-labelledby="data-terms-title">
        <h2 id="data-terms-title">Wallets and public records</h2>
        <p>
          Wallet actions are approved in your wallet application. Credit Passport does not ask for,
          store, or transmit private keys. Transactions, wallet addresses, and credentials written
          to public testnets are public blockchain data.
        </p>
      </section>

      <section className="section" aria-labelledby="risk-terms-title">
        <h2 id="risk-terms-title">No warranty</h2>
        <p>
          The project is provided as-is for a hackathon demonstration. Do not rely on it for real
          financial decisions, custody, identity verification, or production credit assessment.
        </p>
      </section>

      <p className="app-docs-link">
        Technical verification details are in the <Link href="/docs">documentation</Link> and the
        public <a href="https://github.com/Kohap/credit-passport" target="_blank" rel="noreferrer">source repository</a>.
      </p>
    </main>
  );
}
