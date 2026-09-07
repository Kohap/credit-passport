"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import {
  ATTESTOR_DASHBOARD,
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_EXPLORER,
  CREDITCOIN_RPC,
  SCORE_FORMULA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER,
  addresses,
} from "@/config/networks";
import {
  creditLineAbi,
  creditScoreAbi,
  mockMarketAbi,
  mockUsdAbi,
  passportAscAbi,
  passportNftAbi,
} from "@/lib/abi";
import {
  buildProof,
  parsePastableProof,
  ProveCorsError,
  type ProofPayload,
} from "@/lib/buildProof";

type ProvePhase =
  | "idle"
  | "waiting_source"
  | "waiting_attestation"
  | "generating_proof"
  | "submitting"
  | "verified"
  | "error";

function isConfigured(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && !/^0x0+$/.test(addr.slice(2));
}

export function Desk() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [loanId, setLoanId] = useState("1");
  const [amount, setAmount] = useState("100");
  const [repayTx, setRepayTx] = useState<Hex | undefined>();
  const [phase, setPhase] = useState<ProvePhase>("idle");
  const [status, setStatus] = useState(
    "Connect the same wallet on Sepolia and Creditcoin CC3.",
  );
  const [proof, setProof] = useState<ProofPayload | null>(null);
  const [creditTx, setCreditTx] = useState<Hex | undefined>();
  const [borrowTx, setBorrowTx] = useState<Hex | undefined>();
  const [scoreBefore, setScoreBefore] = useState<string | null>(null);
  const [corsFallback, setCorsFallback] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [verified, setVerified] = useState<{
    score: string;
    cap: string;
    tokenId: string;
  } | null>(null);

  const sepoliaReady = isConfigured(addresses.sepoliaMockMarket);
  const creditReady = isConfigured(addresses.creditPassportAsc);

  const { data: score, refetch: refetchScore } = useReadContract({
    address: addresses.creditScore as Address,
    abi: creditScoreAbi,
    functionName: "scoreOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
  });

  const { data: cap, refetch: refetchCap } = useReadContract({
    address: addresses.creditLine as Address,
    abi: creditLineAbi,
    functionName: "borrowCapOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
  });

  const { data: tokenId, refetch: refetchToken } = useReadContract({
    address: addresses.passportNft as Address,
    abi: passportNftAbi,
    functionName: "tokenOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
  });

  const { data: lineBalance } = useReadContract({
    address: addresses.creditMockUsd as Address,
    abi: mockUsdAbi,
    functionName: "balanceOf",
    args: [addresses.creditLine as Address],
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: creditReady },
  });

  const { isLoading: repayPending } = useWaitForTransactionReceipt({
    hash: repayTx,
    chainId: SEPOLIA_CHAIN_ID,
  });

  const ensureSepolia = useCallback(async () => {
    if (chainId !== SEPOLIA_CHAIN_ID) {
      await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
    }
  }, [chainId, switchChainAsync]);

  const ensureCreditcoin = useCallback(async () => {
    if (chainId !== CREDITCOIN_CHAIN_ID) {
      await switchChainAsync({ chainId: CREDITCOIN_CHAIN_ID });
    }
  }, [chainId, switchChainAsync]);

  const addNetworks = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth?.request) {
      setStatus("No injected wallet found to add networks.");
      return;
    }
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
          chainName: sepolia.name,
          nativeCurrency: sepolia.nativeCurrency,
          rpcUrls: [
            process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
              "https://ethereum-sepolia-rpc.publicnode.com",
          ],
          blockExplorerUrls: [SEPOLIA_EXPLORER],
        },
      ],
    });
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${CREDITCOIN_CHAIN_ID.toString(16)}`,
          chainName: "Creditcoin CC3 Testnet",
          nativeCurrency: { name: "tCTC", symbol: "tCTC", decimals: 18 },
          rpcUrls: [CREDITCOIN_RPC],
          blockExplorerUrls: [CREDITCOIN_EXPLORER],
        },
      ],
    });
    setStatus("Sepolia + Creditcoin CC3 added to wallet.");
  }, []);

  async function faucet() {
    await ensureSepolia();
    const hash = await writeContractAsync({
      address: addresses.sepoliaMockUsd as Address,
      abi: mockUsdAbi,
      functionName: "faucet",
      chainId: SEPOLIA_CHAIN_ID,
    });
    setStatus(`Faucet tx ${hash}`);
  }

  async function openLoan() {
    await ensureSepolia();
    const principal = parseEther(amount || "100");
    const hash = await writeContractAsync({
      address: addresses.sepoliaMockMarket as Address,
      abi: mockMarketAbi,
      functionName: "openLoan",
      args: [principal],
      chainId: SEPOLIA_CHAIN_ID,
    });
    setStatus(`Open loan tx ${hash}`);
  }

  async function repayLoan() {
    await ensureSepolia();
    const value = parseEther(amount || "100");
    const id = BigInt(loanId || "1");
    await writeContractAsync({
      address: addresses.sepoliaMockUsd as Address,
      abi: mockUsdAbi,
      functionName: "approve",
      args: [addresses.sepoliaMockMarket as Address, value],
      chainId: SEPOLIA_CHAIN_ID,
    });
    const hash = await writeContractAsync({
      address: addresses.sepoliaMockMarket as Address,
      abi: mockMarketAbi,
      functionName: "repay",
      args: [id, value],
      chainId: SEPOLIA_CHAIN_ID,
    });
    setRepayTx(hash);
    setStatus(`Repay tx ${hash}. Next: prove on Creditcoin.`);
  }

  async function submitProveRepayment(payload: ProofPayload) {
    setPhase("submitting");
    setStatus("Submit proveRepayment on Creditcoin (same wallet)…");
    setScoreBefore(score !== undefined ? score.toString() : "0");
    await ensureCreditcoin();
    const hash = await writeContractAsync({
      address: addresses.creditPassportAsc as Address,
      abi: passportAscAbi,
      functionName: "proveRepayment",
      args: [
        BigInt(payload.chainKey),
        BigInt(payload.headerNumber),
        payload.txBytes,
        payload.merkleRoot,
        payload.siblings,
        payload.lowerEndpointDigest,
        payload.continuityRoots,
        address ?? "0x0000000000000000000000000000000000000000",
      ],
      chainId: CREDITCOIN_CHAIN_ID,
    });
    setCreditTx(hash);
    await Promise.all([refetchScore(), refetchCap(), refetchToken()]);
    setPhase("verified");
    setVerified({
      score: score !== undefined ? score.toString() : "refresh page / wait",
      cap: cap !== undefined ? formatEther(cap) : "refresh",
      tokenId: tokenId !== undefined ? tokenId.toString() : "refresh",
    });
    setStatus(`Verified on Creditcoin. Tx ${hash}`);
    setCorsFallback(false);
  }

  async function proveOnCreditcoin() {
    if (!repayTx) {
      setStatus("Repay on Sepolia first so we have a LoanRepaid tx hash.");
      setPhase("error");
      return;
    }
    try {
      setCorsFallback(false);
      setPhase("waiting_source");
      setStatus("Confirming Sepolia repayment…");
      setPhase("waiting_attestation");
      setStatus(
        "Waiting for Attestcoin height attestation (~15s+ lag; can take minutes)…",
      );
      setPhase("generating_proof");

      const payload = await buildProof(repayTx, (msg) => {
        if (/attestation/i.test(msg)) setPhase("waiting_attestation");
        if (/proof|prover|retry/i.test(msg)) setPhase("generating_proof");
        setStatus(msg);
      });
      setProof(payload);
      await submitProveRepayment(payload);
    } catch (err: unknown) {
      if (err instanceof ProveCorsError) {
        setCorsFallback(true);
        setPhase("error");
        setStatus(
          "Browser blocked the prover (CORS). Use the CLI fallback panel below, then paste the proof JSON.",
        );
        return;
      }
      setPhase("error");
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitPastedProof() {
    try {
      const payload = parsePastableProof(pasteJson, repayTx);
      if (!payload.txBytes || !payload.merkleRoot) {
        throw new Error("Paste JSON missing txBytes / merkleRoot");
      }
      setProof(payload);
      if (payload.sepoliaTxHash && !repayTx) {
        setRepayTx(payload.sepoliaTxHash as Hex);
      }
      await submitProveRepayment(payload);
    } catch (err: unknown) {
      setPhase("error");
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function borrowOnCreditcoin() {
    try {
      await ensureCreditcoin();
      const demoAmount = parseEther("10");
      if (lineBalance !== undefined && lineBalance < demoAmount) {
        setStatus(
          "CreditLine has no mUSD liquidity. Run the fund script: bash scripts/fund-creditline.sh",
        );
        setPhase("error");
        return;
      }
      const hash = await writeContractAsync({
        address: addresses.creditLine as Address,
        abi: creditLineAbi,
        functionName: "borrow",
        args: [demoAmount],
        chainId: CREDITCOIN_CHAIN_ID,
      });
      setBorrowTx(hash);
      setStatus(`Borrowed 10 mUSD on Creditcoin. Tx ${hash}`);
      await refetchCap();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/transfer|insufficient|exceeds balance|ERC20/i.test(msg)) {
        setStatus(
          "CreditLine has no mUSD liquidity. Run the fund script: bash scripts/fund-creditline.sh",
        );
      } else {
        setStatus(msg);
      }
      setPhase("error");
    }
  }

  const phaseClass = useMemo(() => {
    if (phase === "verified") return "status ok";
    if (phase === "error") return "status bad";
    return "status";
  }, [phase]);

  const cliCmd = repayTx
    ? `npm run prove -- ${repayTx} --json-out proof.json`
    : "npm run prove -- 0xSEPOLIA_TX --json-out proof.json";

  const step1State = repayTx ? "done" : "active";
  const step2State =
    phase === "verified"
      ? "done"
      : repayTx
        ? "active"
        : "idle";
  const step3State =
    phase === "verified" || borrowTx
      ? phase === "verified" && borrowTx
        ? "done"
        : "active"
      : "idle";

  const proveBusy =
    phase === "generating_proof" ||
    phase === "waiting_attestation" ||
    phase === "submitting";

  return (
    <main className="desk">
      <header className="desk-top">
        <div className="desk-top-brand">
          <Link href="/" className="desk-home">
            Credit Passport
          </Link>
          <p className="desk-top-lede">
            Prove Sepolia repayment on Creditcoin. Same wallet, Attestcoin verification.
          </p>
        </div>
        <div className="hero-actions">
          <ConnectButton />
          <button type="button" className="btn btn-ghost" onClick={() => void addNetworks()}>
            Add Sepolia + CC3
          </button>
        </div>
      </header>
      <p className="hero-meta desk-meta">
        Sepolia {SEPOLIA_CHAIN_ID} → Creditcoin {CREDITCOIN_CHAIN_ID} · Attestcoin chainKey 1
      </p>

      <ol className="rail" aria-label="Demo progress">
        <li className="rail-step" data-state={step1State}>
          <span className="rail-index">01</span>
          <span className="rail-label">Repay on Sepolia</span>
        </li>
        <li className="rail-step" data-state={step2State}>
          <span className="rail-index">02</span>
          <span className="rail-label">Prove on Creditcoin</span>
        </li>
        <li className="rail-step" data-state={step3State}>
          <span className="rail-index">03</span>
          <span className="rail-label">Unlock credit</span>
        </li>
      </ol>

      {!sepoliaReady || !creditReady ? (
        <section className="alert" role="alert">
          <h2>Deploy addresses missing</h2>
          <p>
            Fill <span className="mono">.env</span> / <span className="mono">NEXT_PUBLIC_*</span>{" "}
            after Foundry deploy. Contract actions will fail until then.
          </p>
        </section>
      ) : null}

      <section className="section" aria-labelledby="step-sepolia">
        <div className="section-head">
          <h2 id="step-sepolia">Sepolia mock loan</h2>
          <span className="section-kicker">Step 01</span>
        </div>
        <p>Faucet mUSD, open a loan, then repay to emit LoanRepaid.</p>
        <div className="field-row">
          <input
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount (ether units)"
            aria-label="Loan amount"
          />
          <input
            className="input"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            placeholder="loanId"
            aria-label="Loan ID"
          />
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady}
            onClick={() => void faucet()}
          >
            Faucet mUSD
          </button>
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady}
            onClick={() => void openLoan()}
          >
            Open loan
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !sepoliaReady || repayPending}
            onClick={() => void repayLoan()}
          >
            {repayPending ? "Confirming repay…" : "Repay loan"}
          </button>
        </div>
        {repayTx ? (
          <p className="tx-line mono">
            Sepolia repay:{" "}
            <a href={`${SEPOLIA_EXPLORER}/tx/${repayTx}`} target="_blank" rel="noreferrer">
              {repayTx}
            </a>
          </p>
        ) : null}
      </section>

      <section className="section" aria-labelledby="step-prove">
        <div className="section-head">
          <h2 id="step-prove">Prove on Creditcoin</h2>
          <span className="section-kicker">Step 02</span>
        </div>
        <p>
          Wait for Attestcoin height attestation, generate the inclusion proof, then submit{" "}
          <span className="mono">proveRepayment</span> with the same wallet.
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !creditReady || !repayTx || proveBusy}
            onClick={() => void proveOnCreditcoin()}
          >
            {proveBusy ? "Proving…" : "Prove repayment"}
          </button>
        </div>
        <p className={phaseClass} role="status" aria-live="polite">
          [{phase}] {status}
        </p>
        {creditTx ? (
          <p className="tx-line mono">
            Creditcoin prove:{" "}
            <a href={`${CREDITCOIN_EXPLORER}/tx/${creditTx}`} target="_blank" rel="noreferrer">
              {creditTx}
            </a>
          </p>
        ) : null}

        {corsFallback ? (
          <div className="cors-panel">
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>CLI proof fallback</h2>
            <p>
              The browser blocked the prover (CORS). Run this locally, then paste{" "}
              <span className="mono">proof.json</span>.
            </p>
            <p className="mono">{cliCmd}</p>
            <p className="mono tx-line">Sepolia tx: {repayTx ?? "-"}</p>
            <textarea
              className="input"
              style={{ marginTop: "0.75rem" }}
              placeholder="Paste proof.json from: npm run prove -- <tx> --json-out proof.json"
              value={pasteJson}
              onChange={(e) => setPasteJson(e.target.value)}
              aria-label="Paste proof JSON"
            />
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!isConnected || !creditReady || !pasteJson.trim()}
                onClick={() => void submitPastedProof()}
              >
                Submit pasted proof
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section" aria-labelledby="step-unlock">
        <div className="section-head">
          <h2 id="step-unlock">Unlock credit</h2>
          <span className="section-kicker">Step 03</span>
        </div>
        <p>After a verified proof, borrow against the CreditLine and read Passport fields.</p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !creditReady || phase !== "verified"}
            onClick={() => void borrowOnCreditcoin()}
          >
            Borrow 10 mUSD
          </button>
        </div>
        {borrowTx ? (
          <p className="tx-line mono">
            Creditcoin borrow:{" "}
            <a href={`${CREDITCOIN_EXPLORER}/tx/${borrowTx}`} target="_blank" rel="noreferrer">
              {borrowTx}
            </a>
          </p>
        ) : null}

        <dl className="kv" style={{ marginTop: "1.5rem" }}>
          <dt>Sepolia repay tx</dt>
          <dd>
            {repayTx || proof?.sepoliaTxHash ? (
              <a
                href={`${SEPOLIA_EXPLORER}/tx/${repayTx ?? proof?.sepoliaTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {repayTx ?? proof?.sepoliaTxHash}
              </a>
            ) : (
              "-"
            )}
          </dd>
          <dt>Creditcoin prove tx</dt>
          <dd>
            {creditTx ? (
              <a href={`${CREDITCOIN_EXPLORER}/tx/${creditTx}`} target="_blank" rel="noreferrer">
                {creditTx}
              </a>
            ) : (
              "-"
            )}
          </dd>
          <dt>Attested block</dt>
          <dd>{proof?.headerNumber ?? proof?.sepoliaBlockNumber ?? "-"}</dd>
          <dt>chainKey</dt>
          <dd>{proof?.chainKey ?? "1"}</dd>
          <dt>Score (before to after)</dt>
          <dd>
            {scoreBefore ?? "-"} {"->"}{" "}
            {score !== undefined ? score.toString() : verified?.score ?? "-"}
          </dd>
          <dt>Borrow cap</dt>
          <dd>{cap !== undefined ? `${formatEther(cap)} mUSD` : verified?.cap ?? "-"}</dd>
          <dt>Passport NFT tokenId</dt>
          <dd>{tokenId !== undefined ? tokenId.toString() : verified?.tokenId ?? "-"}</dd>
          <dt>CreditLine liquidity</dt>
          <dd>
            {lineBalance !== undefined ? `${formatEther(lineBalance)} mUSD` : "-"}
          </dd>
        </dl>
        <p className="tx-line">
          Attestor dashboard:{" "}
          <a href={ATTESTOR_DASHBOARD} target="_blank" rel="noreferrer">
            {ATTESTOR_DASHBOARD}
          </a>
        </p>
      </section>

      <footer className="footnote">
        <h2>How Attestcoin verifies</h2>
        <p>
          Inclusion uses Merkle + continuity proofs via precompile{" "}
          <span className="mono">0x…0FD2</span>. The Creditcoin contract checks{" "}
          <span className="mono">receipt.status == 1</span> and that the log is{" "}
          <span className="mono">LoanRepaid</span> from Sepolia MockMarket, not Chainlink, Pyth, or
          a centralized backend.
        </p>
        <ul>
          {SCORE_FORMULA.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
