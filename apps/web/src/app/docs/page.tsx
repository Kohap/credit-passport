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
            Technical reference for the Credit Passport and Agent Passport testnet demos.
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
        Product pages keep the flow simple. This page contains the network setup, contract
        addresses, proof procedure, and verification evidence behind the demo.
      </p>

      <section className="section" id="mcp">
        <h2>MCP access</h2>
        <p>
          Assistants can read public Credit Passport and Agent Passport testnet records through
          this read-only MCP endpoint. It never receives a private key, signs a message, or
          submits a transaction. Wallet approvals remain in the connected wallet.
        </p>
        <pre className="docs-command"><code>https://www.creditpassport.xyz/api/mcp</code></pre>
        <dl className="kv">
          <dt>get_credit_passport</dt>
          <dd>Read score, verified repayments, and demo credit availability for a wallet.</dd>
          <dt>get_agent_passport</dt>
          <dd>Read completed jobs and settled demo value for an agent wallet.</dd>
          <dt>get_credit_passport_links</dt>
          <dd>Return public app links and the deployed testnet contract addresses.</dd>
        </dl>
      </section>

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

      <section className="section" id="manual-verification">
        <h2>Manual verification</h2>
        <p>
          Use this only when the automatic verification button cannot reach the proof service.
          Generate the proof locally, then paste the resulting JSON file into the matching
          manual verification panel in the app.
        </p>
        <h3 className="docs-subhead">Credit Passport repayment</h3>
        <pre className="docs-command"><code>npm run prove -- &lt;SEPOLIA_REPAYMENT_TX&gt; --json-out proof.json</code></pre>
        <h3 className="docs-subhead">Agent Passport completion</h3>
        <pre className="docs-command"><code>npm run prove -- &lt;SEPOLIA_PAYMENT_TX&gt; --agent --json-out proof.json</code></pre>
      </section>

      <section className="section">
        <h2>Verified proofs</h2>
        <dl className="kv">
          <dt>v2 repayment</dt>
          <dd>
            <a href="https://creditcoin-testnet.blockscout.com/tx/0x1f075244b34a295d176774ac5a7851fcde0306438584b249c04877bf3578072d" target="_blank" rel="noreferrer">
              proveRepayment on Creditcoin
            </a>
          </dd>
          <dt>agent completion</dt>
          <dd>
            <a href="https://creditcoin-testnet.blockscout.com/tx/0x9a0472dce66776f08df3c80a57d52fae22f000328d861412b841628f68dbc8bc" target="_blank" rel="noreferrer">
              proveJobCompletion on Creditcoin
            </a>
          </dd>
        </dl>
      </section>

      <section className="section">
        <h2>Agent Passport alpha</h2>
        <p>
          A distinct client funds an escrowed job, the agent commits a result hash, and the client releases payment. The agent then proves that
          <span className="mono"> JobCompleted </span>
          event through Attestcoin to mint or update a soulbound Agent Passport.
        </p>
        <dl className="kv">
          <dt>Sepolia escrow</dt>
          <dd>0x294400Ddd3F6E11F04d0e16416cc677Dc134a2E1</dd>
          <dt>Creditcoin Agent ASC</dt>
          <dd>0x965bdfEcD8ac53885d1d899E99814Af2752E16C8</dd>
          <dt>first credential</dt>
          <dd>Agent Passport #1, one completed job, 1 mUSD settled</dd>
        </dl>
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
