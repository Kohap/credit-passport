"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isHexString } from "ethers";
import { ConnectButton } from "@/components/ConnectButton";
import {
  ATTESTOR_DASHBOARD,
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_EXPLORER,
  SCORE_FORMULA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_KEY,
  SEPOLIA_EXPLORER,
  addresses,
} from "@/config/networks";

type ProveResult = {
  sepoliaTxHash: string;
  sepoliaBlockNumber: number;
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  merkleRoot: string;
  txBytes: string;
  cached: boolean;
};

type ProveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: ProveResult };

const ZERO = "0x0000000000000000000000000000000000000000";

function shorten(addr: string) {
  return addr === ZERO ? "not deployed" : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Desk() {
  const { address, isConnected, chainId } = useAccount();
  const [txHash, setTxHash] = useState("");
  const [state, setState] = useState<ProveState>({ kind: "idle" });

  const canProve = isHexString(txHash.trim(), 32) && state.kind !== "loading";

  async function prove() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/prove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: txHash.trim() }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof body === "object" && body && "error" in body
            ? String((body as { error: unknown }).error)
            : `request failed (${res.status})`;
        setState({ kind: "error", message });
        return;
      }
      setState({ kind: "ok", data: body as ProveResult });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <main>
      <header className="hero">
        <h1 className="brand">Credit Passport</h1>
        <p className="lede">
          Prove a Sepolia loan repayment on Creditcoin via Attestcoin — unlock a credit
          line, raise a borrow cap, and mint a soulbound Passport. Verification and business
          logic run in a single Creditcoin transaction.
        </p>
        <div className="row">
          <span className="badge">
            Source · <strong>Sepolia</strong> ({SEPOLIA_CHAIN_ID})
          </span>
          <span className="badge">
            chainKey · <strong>{SEPOLIA_CHAIN_KEY}</strong>
          </span>
          <span className="badge">
            Destination · <strong>Creditcoin CC3</strong> ({CREDITCOIN_CHAIN_ID})
          </span>
          <span className="badge">
            Wallet ·{" "}
            <strong>
              {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
            </strong>
          </span>
          {isConnected ? (
            <span className="badge">
              Chain · <strong>{chainId ?? "—"}</strong>
            </span>
          ) : null}
        </div>
        <div className="row">
          <ConnectButton />
          <a className="btn btn-ghost" href={ATTESTOR_DASHBOARD} target="_blank" rel="noreferrer">
            Attestor dashboard
          </a>
        </div>
      </header>

      <section className="grid2">
        <div className="panel">
          <h2>1 · Repay on Sepolia</h2>
          <p>
            Open and repay a loan on <code>MockMarket</code>. The{" "}
            <code>LoanRepaid(borrower, loanId, amount, remainingDebt, timestamp)</code> event
            is the signal Attestcoin will later verify — not a generic ERC-20 transfer.
          </p>
          <dl className="kv">
            <dt>MockUSD</dt>
            <dd>{shorten(addresses.sepoliaMockUsd)}</dd>
            <dt>MockMarket</dt>
            <dd>{shorten(addresses.sepoliaMockMarket)}</dd>
            <dt>Explorer</dt>
            <dd>
              <a href={SEPOLIA_EXPLORER} target="_blank" rel="noreferrer">
                sepolia.etherscan.io
              </a>
            </dd>
          </dl>
        </div>

        <div className="panel">
          <h2>2 · Verify on Creditcoin</h2>
          <p>
            <code>CreditPassportASC.proveRepayment</code> calls the native query precompile at{" "}
            <code>0x…0FD2</code>, requires <code>receiptStatus == 1</code>, checks the trusted
            emitter, then updates score, cap, and the soulbound NFT.
          </p>
          <dl className="kv">
            <dt>Passport ASC</dt>
            <dd>{shorten(addresses.creditPassportAsc)}</dd>
            <dt>CreditScore</dt>
            <dd>{shorten(addresses.creditScore)}</dd>
            <dt>CreditLine</dt>
            <dd>{shorten(addresses.creditLine)}</dd>
            <dt>Passport NFT</dt>
            <dd>{shorten(addresses.passportNft)}</dd>
            <dt>Explorer</dt>
            <dd>
              <a href={CREDITCOIN_EXPLORER} target="_blank" rel="noreferrer">
                creditcoin-testnet.blockscout.com
              </a>
            </dd>
          </dl>
        </div>
      </section>

      <section className="panel">
        <h2>3 · Build the proof</h2>
        <p>
          Paste a mined Sepolia repayment tx hash. The server waits until its block height is
          attested, then fetches the Merkle + continuity proof used by the ASC on-chain.
        </p>
        <div className="row">
          <input
            className="input"
            placeholder="0x… Sepolia tx hash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProve}
            onClick={prove}
          >
            {state.kind === "loading" ? "Building proof…" : "Build proof"}
          </button>
        </div>

        {state.kind === "loading" ? (
          <p className="status">Waiting for attestation and proof generation… (can take minutes)</p>
        ) : null}
        {state.kind === "error" ? <p className="status bad">✗ {state.message}</p> : null}
        {state.kind === "ok" ? (
          <>
            <p className="status ok">✓ Proof ready {state.data.cached ? "(cached)" : ""}</p>
            <dl className="kv">
              <dt>Block</dt>
              <dd>{state.data.sepoliaBlockNumber}</dd>
              <dt>chainKey</dt>
              <dd>{state.data.chainKey}</dd>
              <dt>Header #</dt>
              <dd>{state.data.headerNumber}</dd>
              <dt>Tx index</dt>
              <dd>{state.data.txIndex}</dd>
              <dt>Merkle root</dt>
              <dd className="mono">{state.data.merkleRoot}</dd>
            </dl>
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2>Scoring (v1)</h2>
        <ul>
          {SCORE_FORMULA.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
