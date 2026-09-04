"use client";

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
  SCORE_FORMULA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER,
  addresses,
} from "@/config/networks";
import { creditcoinTestnet } from "@/lib/wagmi";
import {
  creditLineAbi,
  creditScoreAbi,
  mockMarketAbi,
  mockUsdAbi,
  passportAscAbi,
  passportNftAbi,
} from "@/lib/abi";

type ProvePhase =
  | "idle"
  | "waiting_source"
  | "waiting_attestation"
  | "generating_proof"
  | "submitting"
  | "verified"
  | "error";

type ProofPayload = {
  sepoliaTxHash: string;
  sepoliaBlockNumber: number;
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  merkleRoot: Hex;
  siblings: { hash: Hex; isLeft: boolean }[];
  lowerEndpointDigest: Hex;
  continuityRoots: Hex[];
  txBytes: Hex;
};

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
  const [status, setStatus] = useState("Connect the same wallet on Sepolia and Creditcoin CC3.");
  const [proof, setProof] = useState<ProofPayload | null>(null);
  const [creditTx, setCreditTx] = useState<Hex | undefined>();
  const [verified, setVerified] = useState<{
    score: string;
    cap: string;
    tokenId: string;
  } | null>(null);

  const sepoliaReady = isConfigured(addresses.sepoliaMockMarket);
  const creditReady = isConfigured(addresses.creditPassportAsc);

  const { data: score } = useReadContract({
    address: addresses.creditScore as Address,
    abi: creditScoreAbi,
    functionName: "scoreOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
  });

  const { data: cap } = useReadContract({
    address: addresses.creditLine as Address,
    abi: creditLineAbi,
    functionName: "borrowCapOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
  });

  const { data: tokenId } = useReadContract({
    address: addresses.passportNft as Address,
    abi: passportNftAbi,
    functionName: "tokenOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) && creditReady },
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
          chainName: creditcoinTestnet.name,
          nativeCurrency: creditcoinTestnet.nativeCurrency,
          rpcUrls: [creditcoinTestnet.rpcUrls.default.http[0]],
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
    setStatus(`Repay tx ${hash} — next: prove on Creditcoin.`);
  }

  async function proveOnCreditcoin() {
    if (!repayTx) {
      setStatus("Repay on Sepolia first so we have a LoanRepaid tx hash.");
      setPhase("error");
      return;
    }
    try {
      setPhase("waiting_source");
      setStatus("Confirming Sepolia repayment…");
      setPhase("waiting_attestation");
      setStatus("Waiting for Attestcoin height attestation (~15s lag after source block)…");
      setPhase("generating_proof");

      const res = await fetch("/api/prove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: repayTx }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const err =
          typeof body === "object" && body && "error" in body
            ? String((body as { error: string }).error)
            : res.statusText;
        throw new Error(err);
      }
      const payload = body as ProofPayload;
      setProof(payload);

      setPhase("submitting");
      setStatus("Submit proveRepayment on Creditcoin (same wallet)…");
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
      setPhase("verified");
      setVerified({
        score: score !== undefined ? score.toString() : "refresh",
        cap: cap !== undefined ? formatEther(cap) : "refresh",
        tokenId: tokenId !== undefined ? tokenId.toString() : "refresh",
      });
      setStatus(`Verified on Creditcoin. Tx ${hash}`);
    } catch (err: unknown) {
      setPhase("error");
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  const phaseClass = useMemo(() => {
    if (phase === "verified") return "status ok";
    if (phase === "error") return "status bad";
    return "status";
  }, [phase]);

  return (
    <main>
      <section className="hero">
        <p className="badge">
          <strong>CREDIT PASSPORT</strong> · BUIDL CTC 2026 · DeFi / Attestcoin
        </p>
        <h1 className="brand">Credit Passport</h1>
        <p className="lede">
          Prove that a borrower repaid on Ethereum Sepolia. Attestcoin verifies the tx +{" "}
          <span className="mono">LoanRepaid</span> logs on Creditcoin CC3. Then unlock a credit
          line and mint a soulbound Passport — no oracle operator.
        </p>
        <div className="row">
          <ConnectButton />
          <button type="button" className="btn btn-ghost" onClick={() => void addNetworks()}>
            Add Sepolia + CC3 to wallet
          </button>
        </div>
        <div className="row">
          <span className="badge">
            Sepolia <strong>{SEPOLIA_CHAIN_ID}</strong>
          </span>
          <span className="badge">
            Creditcoin <strong>{CREDITCOIN_CHAIN_ID}</strong>
          </span>
          <span className="badge">
            chainKey <strong>1</strong> (≠ chainId)
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>How Attestcoin is used</h2>
        <p>
          Attestcoin verifies inclusion with Merkle + continuity proofs via precompile{" "}
          <span className="mono">0x…0FD2</span>. The Creditcoin contract checks{" "}
          <span className="mono">receipt.status == 1</span> and that the log is{" "}
          <span className="mono">LoanRepaid</span> from our Sepolia MockMarket. No Chainlink / Pyth
          / centralized backend is the source of truth.
        </p>
        <ul>
          {SCORE_FORMULA.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {!sepoliaReady || !creditReady ? (
        <section className="panel">
          <h2>Deploy addresses missing</h2>
          <p>
            Fill <span className="mono">.env</span> / <span className="mono">NEXT_PUBLIC_*</span>{" "}
            after running the Foundry deploy scripts. Until then, UI actions that need contracts
            will fail.
          </p>
        </section>
      ) : null}

      <div className="grid2">
        <section className="panel">
          <h2>1 · Sepolia mock loan</h2>
          <p>Faucet mUSD → open 100 mUSD loan → repay (emits LoanRepaid).</p>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <input
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="amount (ether units)"
            />
            <input
              className="input"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              placeholder="loanId"
            />
          </div>
          <div className="row" style={{ marginTop: "0.75rem" }}>
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
              Repay loan
            </button>
          </div>
          {repayTx ? (
            <p className="mono" style={{ marginTop: "0.75rem" }}>
              Sepolia repay:{" "}
              <a href={`${SEPOLIA_EXPLORER}/tx/${repayTx}`} target="_blank" rel="noreferrer">
                {repayTx}
              </a>
            </p>
          ) : null}
        </section>

        <section className="panel">
          <h2>2 · Prove on Creditcoin</h2>
          <p>
            Wait for attestation → generate proof → your wallet submits{" "}
            <span className="mono">proveRepayment</span>.
          </p>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isConnected || !creditReady || !repayTx || phase === "generating_proof"}
              onClick={() => void proveOnCreditcoin()}
            >
              Prove repayment on Creditcoin
            </button>
          </div>
          <p className={phaseClass} style={{ marginTop: "0.75rem" }}>
            [{phase}] {status}
          </p>
          {creditTx ? (
            <p className="mono">
              Creditcoin tx:{" "}
              <a href={`${CREDITCOIN_EXPLORER}/tx/${creditTx}`} target="_blank" rel="noreferrer">
                {creditTx}
              </a>
            </p>
          ) : null}
        </section>
      </div>

      <section className="panel">
        <h2>Verified fields</h2>
        <dl className="kv">
          <dt>Sepolia tx</dt>
          <dd>{proof?.sepoliaTxHash ?? repayTx ?? "—"}</dd>
          <dt>Attested block</dt>
          <dd>{proof?.headerNumber ?? proof?.sepoliaBlockNumber ?? "—"}</dd>
          <dt>chainKey</dt>
          <dd>{proof?.chainKey ?? "1"}</dd>
          <dt>Score</dt>
          <dd>{score !== undefined ? score.toString() : verified?.score ?? "—"}</dd>
          <dt>Borrow cap</dt>
          <dd>{cap !== undefined ? `${formatEther(cap)} mUSD` : verified?.cap ?? "—"}</dd>
          <dt>Passport NFT</dt>
          <dd>{tokenId !== undefined ? tokenId.toString() : verified?.tokenId ?? "—"}</dd>
        </dl>
        <p style={{ marginTop: "0.75rem" }}>
          Attestor dashboard:{" "}
          <a href={ATTESTOR_DASHBOARD} target="_blank" rel="noreferrer">
            {ATTESTOR_DASHBOARD}
          </a>
        </p>
      </section>
    </main>
  );
}
