"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import {
  formatEther,
  isAddress,
  keccak256,
  parseEther,
  parseEventLogs,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { ConnectButton } from "@/components/ConnectButton";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_EXPLORER,
  CREDITCOIN_RPC,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER,
  SEPOLIA_RPC,
  addresses,
} from "@/config/networks";
import {
  agentJobEscrowAbi,
  agentPassportAscAbi,
  agentPassportNftAbi,
  mockUsdAbi,
} from "@/lib/abi";
import {
  buildProof,
  parsePastableProof,
  ProveCorsError,
  type ProofPayload,
} from "@/lib/buildProof";
import {
  addWalletChain,
  sendPopulatedWrite,
  type WalletChain,
  type WalletRequest,
} from "@/lib/sepolia-write";
import type { WalletProvider } from "@/lib/wallet-session";

const MAX_UINT256 = (1n << 256n) - 1n;
const JOB_STATES = ["Not found", "Funded", "Work submitted", "Completed", "Cancelled"] as const;

const sepoliaWalletChain: WalletChain = {
  id: SEPOLIA_CHAIN_ID,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [SEPOLIA_RPC],
  blockExplorerUrls: [SEPOLIA_EXPLORER],
};

const creditcoinWalletChain: WalletChain = {
  id: CREDITCOIN_CHAIN_ID,
  name: "Creditcoin CC3 Testnet",
  nativeCurrency: { name: "tCTC", symbol: "tCTC", decimals: 18 },
  rpcUrls: [CREDITCOIN_RPC],
  blockExplorerUrls: [CREDITCOIN_EXPLORER],
};

function parseJobId(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d{1,78}$/.test(trimmed)) throw new Error("Job ID must be a whole number.");
  const jobId = BigInt(trimmed);
  if (jobId === 0n || jobId > MAX_UINT256) throw new Error("Job ID is outside the supported range.");
  return jobId;
}

function parseAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,58})(?:\.\d{1,18})?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number with up to 18 decimal places.");
  }
  const amount = parseEther(trimmed);
  if (amount === 0n || amount > MAX_UINT256) throw new Error("Amount is outside the supported range.");
  return amount;
}

function hashCommitment(value: string, label: string): Hex {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 4_000) {
    throw new Error(`${label} must be between 3 and 4,000 characters.`);
  }
  return keccak256(stringToHex(trimmed));
}

function isHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

function jobStateLabel(state: number | undefined): string {
  return state !== undefined && state >= 0 && state < JOB_STATES.length ? JOB_STATES[state] : "Choose a job";
}

export function AgentDesk() {
  const { address, connector, isConnected } = useAccount();
  const sepoliaClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const creditcoinClient = usePublicClient({ chainId: CREDITCOIN_CHAIN_ID });
  const [agentAddress, setAgentAddress] = useState("");
  const [amount, setAmount] = useState("1");
  const [brief, setBrief] = useState("");
  const [jobId, setJobId] = useState("");
  const [result, setResult] = useState("");
  const [completionTx, setCompletionTx] = useState("");
  const [status, setStatus] = useState("Connect a wallet to create a verified record of client-approved work.");
  const [busy, setBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proof, setProof] = useState<ProofPayload | null>(null);
  const [proofJson, setProofJson] = useState("");
  const [showProofFallback, setShowProofFallback] = useState(false);

  const selectedJobId = useMemo(() => {
    try {
      return jobId.trim() ? parseJobId(jobId) : undefined;
    } catch {
      return undefined;
    }
  }, [jobId]);

  const { data: musd, refetch: refetchMusd } = useReadContract({
    address: addresses.sepoliaMockUsd as Address,
    abi: mockUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const { data: job, refetch: refetchJob } = useReadContract({
    address: addresses.sepoliaAgentJobEscrow as Address,
    abi: agentJobEscrowAbi,
    functionName: "jobs",
    args: selectedJobId ? [selectedJobId] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(selectedJobId) },
  });
  const { data: passportTokenId, refetch: refetchToken } = useReadContract({
    address: addresses.agentPassportNft as Address,
    abi: agentPassportNftAbi,
    functionName: "tokenOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const { data: completedJobs, refetch: refetchCompletedJobs } = useReadContract({
    address: addresses.agentPassportAsc as Address,
    abi: agentPassportAscAbi,
    functionName: "completedJobsOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const { data: settledVolume, refetch: refetchSettledVolume } = useReadContract({
    address: addresses.agentPassportAsc as Address,
    abi: agentPassportAscAbi,
    functionName: "settledVolumeOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const selectedWalletRequest = useCallback(async (): Promise<WalletRequest> => {
    const provider = (await connector?.getProvider()) as WalletProvider | undefined;
    if (!provider || typeof provider.request !== "function") {
      throw new Error("Wallet is unavailable. Reconnect the selected wallet, then retry.");
    }
    return provider.request.bind(provider) as WalletRequest;
  }, [connector]);

  const refreshPassport = useCallback(async () => {
    await Promise.all([refetchToken(), refetchCompletedJobs(), refetchSettledVolume()]);
  }, [refetchCompletedJobs, refetchSettledVolume, refetchToken]);

  async function faucet() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    setBusy(true);
    try {
      setStatus("Requesting demo mUSD on Sepolia…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaMockUsd as Address,
        abi: mockUsdAbi,
        functionName: "faucet",
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      await refetchMusd();
      setStatus("Demo mUSD is ready. Approve the escrow, then fund a job.");
    } finally {
      setBusy(false);
    }
  }

  async function approveEscrow() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    const value = parseAmount(amount);
    setBusy(true);
    try {
      setStatus("Approving the job escrow to use this demo amount…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaMockUsd as Address,
        abi: mockUsdAbi,
        functionName: "approve",
        functionArgs: [addresses.sepoliaAgentJobEscrow as Address, value],
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      setStatus("Escrow approved. You can now fund the job.");
    } finally {
      setBusy(false);
    }
  }

  async function createJob() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    if (!isAddress(agentAddress)) throw new Error("Enter a valid agent wallet address.");
    if (agentAddress.toLowerCase() === address.toLowerCase()) {
      throw new Error("A client cannot fund a job for the same wallet.");
    }
    const value = parseAmount(amount);
    const briefHash = hashCommitment(brief, "Work brief");
    setBusy(true);
    try {
      setStatus("Funding the job escrow…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaAgentJobEscrow as Address,
        abi: agentJobEscrowAbi,
        functionName: "createJob",
        functionArgs: [agentAddress as Address, value, briefHash],
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      const events = parseEventLogs({ abi: agentJobEscrowAbi, eventName: "JobFunded", logs: receipt.logs });
      const createdJobId = events[0]?.args.jobId;
      if (createdJobId !== undefined) setJobId(createdJobId.toString());
      await refetchMusd();
      setStatus(createdJobId !== undefined ? `Job #${createdJobId} is funded. The assigned agent can now commit its work.` : "Job funded. Share the job ID with the assigned agent.");
    } finally {
      setBusy(false);
    }
  }

  async function submitWork() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    const id = parseJobId(jobId);
    const resultHash = hashCommitment(result, "Result reference");
    setBusy(true);
    try {
      setStatus("Committing the completed work…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaAgentJobEscrow as Address,
        abi: agentJobEscrowAbi,
        functionName: "submitWork",
        functionArgs: [id, resultHash],
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      await refetchJob();
      setStatus("Work committed. The client can now release the escrow when they accept it.");
    } finally {
      setBusy(false);
    }
  }

  async function approveCompletion() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    const id = parseJobId(jobId);
    setBusy(true);
    try {
      setStatus("Releasing the escrow to the agent…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaAgentJobEscrow as Address,
        abi: agentJobEscrowAbi,
        functionName: "approveCompletion",
        functionArgs: [id],
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      setCompletionTx(hash);
      await refetchJob();
      setStatus("Payment released. Send this Sepolia transaction to the agent so they can verify the completed job.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob() {
    if (!address || !sepoliaClient) throw new Error("Connect a wallet first.");
    const id = parseJobId(jobId);
    setBusy(true);
    try {
      setStatus("Cancelling the unfunded work request…");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaAgentJobEscrow as Address,
        abi: agentJobEscrowAbi,
        functionName: "cancelBeforeSubmission",
        functionArgs: [id],
        chain: sepoliaWalletChain,
        request: await selectedWalletRequest(),
      });
      await sepoliaClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      await refetchJob();
      setStatus("Job cancelled and the escrow has returned to the client.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(payload: ProofPayload) {
    if (!address || !creditcoinClient) throw new Error("Connect the agent wallet first.");
    setProofBusy(true);
    try {
      setStatus("Writing the verified completion to the Agent Passport…");
      const hash = await sendPopulatedWrite({
        publicClient: creditcoinClient,
        account: address,
        address: addresses.agentPassportAsc as Address,
        abi: agentPassportAscAbi,
        functionName: "proveJobCompletion",
        functionArgs: [
          BigInt(payload.chainKey),
          BigInt(payload.headerNumber),
          payload.txBytes,
          payload.merkleRoot,
          payload.siblings,
          payload.lowerEndpointDigest,
          payload.continuityRoots,
          address,
        ],
        chain: creditcoinWalletChain,
        request: await selectedWalletRequest(),
      });
      await creditcoinClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      await refreshPassport();
      setStatus(`Completion verified on Creditcoin. Your Agent Passport has been updated: ${hash}`);
    } finally {
      setProofBusy(false);
    }
  }

  async function proveCompletion() {
    if (!isHash(completionTx)) throw new Error("Paste the Sepolia JobCompleted transaction hash first.");
    setProofBusy(true);
    setShowProofFallback(false);
    try {
      const built = await buildProof(completionTx, setStatus);
      setProof(built);
      await submitProof(built);
    } catch (error) {
      if (error instanceof ProveCorsError) setShowProofFallback(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setProofBusy(false);
    }
  }

  async function submitPastedProof() {
    if (!isHash(completionTx)) throw new Error("Paste the Sepolia JobCompleted transaction hash first.");
    const pasted = parsePastableProof(proofJson, completionTx);
    setProof(pasted);
    await submitProof(pasted);
  }

  async function addNetworks() {
    const request = await selectedWalletRequest();
    await addWalletChain(request, sepoliaWalletChain);
    await addWalletChain(request, creditcoinWalletChain);
    setStatus("Sepolia and Creditcoin CC3 are ready in the selected wallet.");
  }

  const jobState = job ? Number(job[5]) : undefined;
  const currentAgent = job?.[1];
  const currentClient = job?.[0];
  const currentAmount = job?.[2];
  const canCancel = Boolean(address && currentClient?.toLowerCase() === address.toLowerCase() && jobState === 1);
  const canSubmit = Boolean(address && currentAgent?.toLowerCase() === address.toLowerCase() && jobState === 1);
  const canApprove = Boolean(address && currentClient?.toLowerCase() === address.toLowerCase() && jobState === 2);
  const hasPassport = passportTokenId !== undefined && passportTokenId !== 0n;

  return (
    <main className="desk agent-desk">
      <header className="desk-top">
        <div className="desk-top-brand">
          <Link href="/" className="desk-home">Agent Passport</Link>
          <p className="desk-top-lede">A portable record of client-approved agent work.</p>
        </div>
        <Link href="/app" className="btn btn-ghost">Credit Passport</Link>
      </header>

      <section className="journey-card" aria-labelledby="agent-title">
        <p className="journey-kicker">Live testnet alpha</p>
        <h1 id="agent-title">Let completed work speak for your agent.</h1>
        <p>A client funds a demo job, an agent commits its result, and the client releases payment. Creditcoin then verifies that release as a non-transferable Agent Passport record.</p>
        {!isConnected ? (
          <div className="journey-actions">
            <ConnectButton />
            <button type="button" className="btn btn-ghost" onClick={() => void addNetworks()}>Set up test networks</button>
          </div>
        ) : null}
      </section>

      <ol className="rail agent-flow" aria-label="Agent Passport journey">
        <li className="rail-step" data-state={jobState && jobState >= 1 ? "done" : "active"}><span className="rail-index">01</span><span className="rail-label">Fund a job</span></li>
        <li className="rail-step" data-state={jobState && jobState >= 2 ? "done" : "idle"}><span className="rail-index">02</span><span className="rail-label">Commit work</span></li>
        <li className="rail-step" data-state={jobState && jobState >= 3 ? "done" : "idle"}><span className="rail-index">03</span><span className="rail-label">Release payment</span></li>
        <li className="rail-step" data-state={hasPassport ? "done" : "idle"}><span className="rail-index">04</span><span className="rail-label">Verify record</span></li>
      </ol>

      <section className="section" aria-labelledby="agent-record-title">
        <div className="section-head"><h2 id="agent-record-title">Your Agent Passport</h2><span className="section-kicker">Creditcoin CC3</span></div>
        {hasPassport ? (
          <dl className="agent-record">
            <div><dt>Passport</dt><dd>#{passportTokenId.toString()}</dd></div>
            <div><dt>Completed jobs</dt><dd>{completedJobs?.toString() ?? "-"}</dd></div>
            <div><dt>Settled volume</dt><dd>{settledVolume !== undefined ? `${formatEther(settledVolume)} mUSD` : "-"}</dd></div>
          </dl>
        ) : <p>Your connected wallet has no verified jobs yet. Complete a funded job below to create its first record.</p>}
      </section>

      <section className="section" aria-labelledby="fund-job-title">
        <div className="section-head"><h2 id="fund-job-title">Fund a job</h2><span className="section-kicker">Client</span></div>
        <p>Use demo mUSD only. Your brief is not published; its commitment is recorded so the job can be tied to the agreed work.</p>
        <p className="tx-line mono">Sepolia mUSD {musd === undefined ? "-" : Number(formatEther(musd)).toLocaleString()}</p>
        <div className="agent-fields">
          <label className="field-label" htmlFor="agent-wallet"><span>Agent wallet</span><input id="agent-wallet" className="input agent-input" value={agentAddress} onChange={(event) => setAgentAddress(event.target.value)} placeholder="0x…" autoComplete="off" /></label>
          <label className="field-label" htmlFor="agent-amount"><span>Demo amount (mUSD)</span><input id="agent-amount" className="input agent-input" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></label>
          <label className="field-label agent-text-field" htmlFor="job-brief"><span>Work brief</span><textarea id="job-brief" className="input" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe the work the agent should complete" /></label>
        </div>
        <div className="actions agent-actions">
          <button type="button" className="btn" disabled={!isConnected || busy} onClick={() => void faucet().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Get demo funds</button>
          <button type="button" className="btn" disabled={!isConnected || busy} onClick={() => void approveEscrow().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Approve escrow</button>
          <button type="button" className="btn btn-primary" disabled={!isConnected || busy} onClick={() => void createJob().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Fund job</button>
        </div>
      </section>

      <section className="section" aria-labelledby="job-title">
        <div className="section-head"><h2 id="job-title">Work on a job</h2><span className="section-kicker">Client or agent</span></div>
        <p>Enter the job ID to see its state. Only the assigned agent can commit a result, and only the client can release payment.</p>
        <div className="agent-fields agent-job-field">
          <label className="field-label" htmlFor="job-id"><span>Job ID</span><input id="job-id" className="input agent-input" value={jobId} onChange={(event) => setJobId(event.target.value)} inputMode="numeric" /></label>
          <button type="button" className="btn btn-ghost agent-refresh" disabled={!selectedJobId} onClick={() => void refetchJob()}>Refresh job</button>
        </div>
        {selectedJobId ? <div className="agent-job-summary"><strong>Job #{selectedJobId.toString()}</strong><span>{jobStateLabel(jobState)}</span>{currentAmount !== undefined ? <span>{formatEther(currentAmount)} mUSD</span> : null}</div> : null}
        <div className="agent-fields">
          <label className="field-label agent-text-field" htmlFor="result-reference"><span>Result reference</span><textarea id="result-reference" className="input" value={result} onChange={(event) => setResult(event.target.value)} placeholder="Paste a result URL, content digest, or delivery note" /></label>
        </div>
        <div className="actions agent-actions">
          <button type="button" className="btn" disabled={!isConnected || busy || !canSubmit} onClick={() => void submitWork().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Commit work</button>
          <button type="button" className="btn btn-primary" disabled={!isConnected || busy || !canApprove} onClick={() => void approveCompletion().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Release payment</button>
          <button type="button" className="btn btn-ghost" disabled={!isConnected || busy || !canCancel} onClick={() => void cancelJob().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Cancel before work</button>
        </div>
      </section>

      <section className="section" aria-labelledby="verify-job-title">
        <div className="section-head"><h2 id="verify-job-title">Verify a completed job</h2><span className="section-kicker">Assigned agent</span></div>
        <p>Paste the Sepolia transaction created when the client released payment. Use the same agent wallet that was assigned to the job.</p>
        <label className="field-label" htmlFor="completion-tx"><span>Sepolia JobCompleted transaction</span><input id="completion-tx" className="input agent-tx-input mono" value={completionTx} onChange={(event) => setCompletionTx(event.target.value.trim())} placeholder="0x…" autoComplete="off" /></label>
        <div className="actions agent-actions"><button type="button" className="btn btn-primary" disabled={!isConnected || proofBusy || !isHash(completionTx)} onClick={() => void proveCompletion().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>{proofBusy ? "Verifying completion…" : proof ? "Submit verified record" : "Verify completed job"}</button></div>
        {showProofFallback ? <div className="cors-panel"><h2>Proof fallback</h2><p>The browser cannot reach the proof service. Generate the proof locally, then paste the JSON here.</p><p className="mono">npm run prove -- {completionTx || "0xJOB_COMPLETED_TX"} --agent --json-out proof.json</p><textarea className="input" value={proofJson} onChange={(event) => setProofJson(event.target.value)} placeholder="Paste proof.json" aria-label="Agent completion proof JSON" /><div className="actions"><button type="button" className="btn btn-primary" disabled={!isConnected || proofBusy || !proofJson.trim()} onClick={() => void submitPastedProof().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)))}>Submit proof</button></div></div> : null}
      </section>

      <p className="status" role="status" aria-live="polite"><strong>{busy || proofBusy ? "In progress" : "Status"}</strong><span>{status}</span></p>
      <p className="app-docs-link">Agent Passport records client-approved settlement and a result commitment. <Link href="/docs">Read the protocol details</Link>.</p>
    </main>
  );
}
