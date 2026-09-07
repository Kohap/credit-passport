"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther, parseEventLogs, type Address, type Hex } from "viem";
import {
  ATTESTOR_DASHBOARD,
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_EXPLORER,
  CREDITCOIN_RPC,
  SCORE_FORMULA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER,
  SEPOLIA_RPC,
  addresses,
} from "@/config/networks";
import { sendPopulatedWrite } from "@/lib/sepolia-write";
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

type ActiveLoan = {
  id: bigint;
  principal: bigint;
  debt: bigint;
};

const MAX_LOANS_TO_SHOW = 100n;

function isConfigured(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && !/^0x0+$/.test(addr.slice(2));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function Desk() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const sepoliaClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });

  const previousAddress = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousAddress.current && previousAddress.current !== address) {
      setFaucetTx(undefined);
      setRepayTx(undefined);
      setCreditTx(undefined);
      setBorrowTx(undefined);
      setProof(null);
      setVerified(null);
      setPhase("idle");
      setStatus(
        address
          ? "Wallet switched. Faucet mUSD with this account."
          : "Wallet disconnected.",
      );
    }
    previousAddress.current = address;
  }, [address]);


  const [loanId, setLoanId] = useState("");
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
  const [faucetTx, setFaucetTx] = useState<Hex | undefined>();
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [openLoanBusy, setOpenLoanBusy] = useState(false);
  const [repayBusy, setRepayBusy] = useState(false);
  const [repayAll, setRepayAll] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [activeLoansBusy, setActiveLoansBusy] = useState(false);
  const [loanRefresh, setLoanRefresh] = useState(0);
  const [verified, setVerified] = useState<{
    score: string;
    cap: string;
    tokenId: string;
  } | null>(null);

  const sepoliaReady = isConfigured(addresses.sepoliaMockMarket);
  const creditReady = isConfigured(addresses.creditPassportAsc);

  const { data: musd, refetch: refetchMusd } = useReadContract({
    address: addresses.sepoliaMockUsd as Address,
    abi: mockUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address) && sepoliaReady },
  });

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

  const { data: nextLoanId, refetch: refetchLoanCounter } = useReadContract({
    address: addresses.sepoliaMockMarket as Address,
    abi: mockMarketAbi,
    functionName: "nextLoanId",
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address) && sepoliaReady },
  });

  useEffect(() => {
    let cancelled = false;
    async function loadActiveLoans() {
      if (!address || !sepoliaClient || !nextLoanId || nextLoanId <= 1n) {
        setActiveLoans([]);
        setActiveLoansBusy(false);
        return;
      }
      setActiveLoansBusy(true);
      try {
        const firstLoanId =
          nextLoanId > MAX_LOANS_TO_SHOW + 1n ? nextLoanId - MAX_LOANS_TO_SHOW : 1n;
        const ids = Array.from(
          { length: Number(nextLoanId - firstLoanId) },
          (_, index) => firstLoanId + BigInt(index),
        );
        const loans = await Promise.all(
          ids.map(async (id) => {
            const [borrower, principal, debt, active] = await sepoliaClient.readContract({
              address: addresses.sepoliaMockMarket as Address,
              abi: mockMarketAbi,
              functionName: "loans",
              args: [id],
            });
            return { id, borrower, principal, debt, active };
          }),
        );
        if (!cancelled) {
          setActiveLoans(
            loans
              .filter(
                (loan) =>
                  loan.active && loan.borrower.toLowerCase() === address.toLowerCase(),
              )
              .map(({ id, principal, debt }) => ({ id, principal, debt })),
          );
        }
      } catch {
        if (!cancelled) setActiveLoans([]);
      } finally {
        if (!cancelled) setActiveLoansBusy(false);
      }
    }
    void loadActiveLoans();
    return () => {
      cancelled = true;
    };
  }, [address, nextLoanId, sepoliaClient, loanRefresh]);

  const activeLoanDebt = useMemo(
    () => activeLoans.reduce((total, loan) => total + loan.debt, 0n),
    [activeLoans],
  );

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
    const provider = (await connector?.getProvider()) as
      | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    const request = provider?.request?.bind(provider) ?? window.ethereum?.request?.bind(window.ethereum);
    if (!request) {
      setStatus("No injected wallet found to add networks.");
      return;
    }
    await request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [SEPOLIA_RPC],
          blockExplorerUrls: [SEPOLIA_EXPLORER],
        },
      ],
    });
    await request({
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
  }, [connector]);

  async function selectedWalletRequest() {
    const provider = (await connector?.getProvider()) as
      | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    return provider?.request?.bind(provider);
  }

  async function faucet() {
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    setFaucetBusy(true);
    try {
      const request = await selectedWalletRequest();
      const faucetAmount = parseEther("1000");
      const sendMUsd = (functionName: "faucet" | "mint") =>
        sendPopulatedWrite({
          account: address,
          address: addresses.sepoliaMockUsd as Address,
          abi: mockUsdAbi,
          functionName,
          functionArgs: functionName === "mint" ? [address, faucetAmount] : undefined,
          chainId: SEPOLIA_CHAIN_ID,
          request,
        });

      let useHourlyFaucet = true;
      try {
        if (sepoliaClient) {
          const last = await withTimeout(
            sepoliaClient.readContract({
              address: addresses.sepoliaMockUsd as Address,
              abi: mockUsdAbi,
              functionName: "lastFaucetAt",
              args: [address],
            }),
            8_000,
            "Sepolia RPC took too long while checking faucet cooldown.",
          );
          const now = BigInt(Math.floor(Date.now() / 1000));
          useHourlyFaucet = last === 0n || now >= last + 3600n;
        }
      } catch {
        useHourlyFaucet = true;
      }

      setStatus(
        useHourlyFaucet
          ? "Confirm the mUSD faucet in Rabby or MetaMask."
          : "Hourly faucet already used. Confirm the demo mint fallback.",
      );

      let hash: Hex;
      try {
        hash = await sendMUsd(useHourlyFaucet ? "faucet" : "mint");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/rejected|denied|4001/i.test(msg)) throw err;
        if (/0 Sepolia ETH|Not enough Sepolia ETH|insufficient funds/i.test(msg)) throw err;
        if (/Add Sepolia/i.test(msg)) {
          setStatus("Adding Sepolia to the wallet. Confirm the network prompt.");
          await addNetworks();
        }
        setStatus("Faucet unavailable or cooling down. Confirm the demo mint fallback.");
        hash = await sendMUsd("mint");
      }

      setFaucetTx(hash);
      setStatus("Waiting for Sepolia confirmation…");
      let confirmedBalance: bigint | undefined;
      if (sepoliaClient) {
        const receipt = await sepoliaClient.waitForTransactionReceipt({
          hash,
          timeout: 90_000,
        });
        if (receipt.status === "reverted") {
          throw new Error("Faucet transaction reverted on Sepolia.");
        }
        confirmedBalance = await sepoliaClient.readContract({
          address: addresses.sepoliaMockUsd as Address,
          abi: mockUsdAbi,
          functionName: "balanceOf",
          args: [address],
          blockNumber: receipt.blockNumber,
        });
      }
      const refreshed = await refetchMusd();
      const bal = confirmedBalance ?? refreshed.data;
      const shown =
        bal !== undefined
          ? `${Number(formatEther(bal)).toLocaleString()} mUSD`
          : "1,000 mUSD";
      setStatus(`Received. Balance ${shown}.`);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setFaucetBusy(false);
    }
  }

  async function openLoan() {
    setOpenLoanBusy(true);
    try {
      await ensureSepolia();
      if (!address) throw new Error("Connect wallet first.");
      if (!sepoliaClient) throw new Error("Sepolia RPC unavailable.");
      const principal = parseEther(amount || "100");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaMockMarket as Address,
        abi: mockMarketAbi,
        functionName: "openLoan",
        functionArgs: [principal],
        chainId: SEPOLIA_CHAIN_ID,
        request: await selectedWalletRequest(),
      });
      setStatus("Waiting for loan confirmation on Sepolia…");
      const receipt = await sepoliaClient.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
      if (receipt.status === "reverted") {
        throw new Error("Opening the loan reverted on Sepolia.");
      }
      const opened = parseEventLogs({
        abi: mockMarketAbi,
        eventName: "LoanOpened",
        logs: receipt.logs,
      }).find(
        (log) => log.address.toLowerCase() === addresses.sepoliaMockMarket.toLowerCase(),
      );
      const openedLoanId = opened?.args.loanId;
      if (openedLoanId === undefined) {
        throw new Error("Loan opened, but its ID was not found in the receipt.");
      }
      setLoanId(openedLoanId.toString());
      setLoanRefresh((current) => current + 1);
      await refetchLoanCounter();
      setStatus(`Loan #${openedLoanId} confirmed. Repay this loan next.`);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setOpenLoanBusy(false);
    }
  }

  async function repayLoan() {
    setRepayBusy(true);
    try {
      await ensureSepolia();
      if (!address) throw new Error("Connect wallet first.");
      if (!sepoliaClient) throw new Error("Sepolia RPC unavailable.");
      const request = await selectedWalletRequest();
      const requestedIds = repayAll
        ? activeLoans.map((loan) => loan.id)
        : loanId.trim()
          ? [BigInt(loanId)]
          : [];
      if (!requestedIds.length) {
        throw new Error(
          repayAll
            ? "No active loans are available to repay."
            : "Select an active loan or enter its loan ID before repaying.",
        );
      }
      const requestedAmount = repayAll ? 0n : parseEther(amount || "100");
      const currentLoans = await Promise.all(
        requestedIds.map(async (id) => {
          const [borrower, principal, debt, active] = await sepoliaClient.readContract({
            address: addresses.sepoliaMockMarket as Address,
            abi: mockMarketAbi,
            functionName: "loans",
            args: [id],
          });
          if (!active) throw new Error(`Loan #${id} is not active.`);
          if (borrower.toLowerCase() !== address.toLowerCase()) {
            throw new Error(`Loan #${id} belongs to a different wallet.`);
          }
          const value = repayAll ? debt : requestedAmount;
          if (value > debt) {
            throw new Error(
              `Loan #${id} has ${formatEther(debt)} mUSD remaining. Lower the repayment amount.`,
            );
          }
          return { id, principal, debt, value };
        }),
      );
      const total = currentLoans.reduce((sum, loan) => sum + loan.value, 0n);
      const balance = await sepoliaClient.readContract({
        address: addresses.sepoliaMockUsd as Address,
        abi: mockUsdAbi,
        functionName: "balanceOf",
        args: [address],
      });
      if (balance < total) {
        throw new Error(
          `Need ${formatEther(total)} mUSD to repay this selection; wallet balance is ${formatEther(balance)} mUSD.`,
        );
      }
      const allowance = await sepoliaClient.readContract({
        address: addresses.sepoliaMockUsd as Address,
        abi: mockUsdAbi,
        functionName: "allowance",
        args: [address, addresses.sepoliaMockMarket as Address],
      });

      if (allowance < total) {
        setStatus(
          `Confirm mUSD approval for ${formatEther(total)} mUSD, then wait for Sepolia confirmation.`,
        );
        const approvalHash = await sendPopulatedWrite({
          publicClient: sepoliaClient,
          account: address,
          address: addresses.sepoliaMockUsd as Address,
          abi: mockUsdAbi,
          functionName: "approve",
          functionArgs: [addresses.sepoliaMockMarket as Address, total],
          chainId: SEPOLIA_CHAIN_ID,
          request,
        });
        const approvalReceipt = await sepoliaClient.waitForTransactionReceipt({
          hash: approvalHash,
          timeout: 90_000,
        });
        if (approvalReceipt.status === "reverted") {
          throw new Error("mUSD approval reverted on Sepolia.");
        }
      }

      let lastHash: Hex | undefined;
      for (const [index, loan] of currentLoans.entries()) {
        setStatus(
          `Confirm repayment for loan #${loan.id} (${index + 1}/${currentLoans.length}) in your wallet.`,
        );
        const hash = await sendPopulatedWrite({
          publicClient: sepoliaClient,
          account: address,
          address: addresses.sepoliaMockMarket as Address,
          abi: mockMarketAbi,
          functionName: "repay",
          functionArgs: [loan.id, loan.value],
          chainId: SEPOLIA_CHAIN_ID,
          request,
        });
        const receipt = await sepoliaClient.waitForTransactionReceipt({
          hash,
          timeout: 90_000,
        });
        if (receipt.status === "reverted") {
          throw new Error(`Repayment for loan #${loan.id} reverted on Sepolia.`);
        }
        lastHash = hash;
      }
      setRepayTx(lastHash);
      setLoanRefresh((current) => current + 1);
      setStatus(
        `${currentLoans.length === 1 ? "Repayment" : "All repayments"} confirmed. The last repayment is ready to prove on Creditcoin.`,
      );
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setRepayBusy(false);
    }
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
        <p className="tx-line mono">
          Sepolia mUSD{" "}
          {musd !== undefined ? Number(formatEther(musd)).toLocaleString() : "—"}
        </p>
        <div className="loan-dashboard" aria-live="polite">
          <div className="loan-dashboard-head">
            <div>
              <span className="loan-dashboard-label">Active loans</span>
              <strong>
                {activeLoansBusy
                  ? "Checking Sepolia…"
                  : activeLoans.length
                    ? `${activeLoans.length} open`
                    : "None open"}
              </strong>
            </div>
            {activeLoans.length ? (
              <span className="loan-total">{formatEther(activeLoanDebt)} mUSD due</span>
            ) : null}
          </div>
          {activeLoans.map((loan) => {
            const selected = loanId === loan.id.toString() && !repayAll;
            return (
              <button
                key={loan.id.toString()}
                type="button"
                className="loan-row"
                aria-pressed={selected}
                disabled={repayBusy || openLoanBusy}
                onClick={() => {
                  setRepayAll(false);
                  setLoanId(loan.id.toString());
                  setAmount(formatEther(loan.debt));
                }}
              >
                <span>Loan #{loan.id}</span>
                <span>{formatEther(loan.debt)} mUSD due</span>
                <span>{formatEther(loan.principal)} mUSD opened</span>
              </button>
            );
          })}
          <label className="loan-toggle">
            <input
              type="checkbox"
              checked={repayAll}
              disabled={!activeLoans.length || repayBusy || openLoanBusy}
              onChange={(event) => setRepayAll(event.target.checked)}
            />
            <span>Repay all active loans</span>
            {repayAll ? <small>{formatEther(activeLoanDebt)} mUSD across {activeLoans.length} loans</small> : null}
          </label>
        </div>
        <div className="field-row">
          <input
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount (ether units)"
            aria-label="Loan amount"
            disabled={repayAll}
          />
          <input
            className="input"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            placeholder="loan ID (set after opening)"
            aria-label="Loan ID"
            disabled={repayAll}
          />
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady || faucetBusy}
            onClick={() => void faucet().catch((e: unknown) => setStatus(e instanceof Error ? e.message : String(e)))}
          >
            {faucetBusy ? "Confirm in wallet…" : "Faucet mUSD"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady || faucetBusy || openLoanBusy || repayBusy}
            onClick={() => void openLoan()}
          >
            {openLoanBusy ? "Confirm in wallet…" : "Open loan"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !sepoliaReady || repayBusy || faucetBusy || openLoanBusy}
            onClick={() => void repayLoan()}
          >
            {repayBusy ? "Confirming repay…" : "Repay loan"}
          </button>
        </div>
        {faucetTx ? (
          <p className="tx-line mono">
            Sepolia faucet:{" "}
            <a href={`${SEPOLIA_EXPLORER}/tx/${faucetTx}`} target="_blank" rel="noreferrer">
              {faucetTx}
            </a>
          </p>
        ) : null}
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
