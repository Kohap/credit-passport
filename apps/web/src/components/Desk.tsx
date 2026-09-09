"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { formatEther, parseEther, parseEventLogs, type Address, type Hex } from "viem";
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
  addWalletChain,
  sendPopulatedWrite,
  type WalletChain,
} from "@/lib/sepolia-write";
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
  | "proof_ready"
  | "submitting"
  | "verified"
  | "error";

type ActiveLoan = {
  id: bigint;
  principal: bigint;
  debt: bigint;
};

const MAX_UINT256 = (1n << 256n) - 1n;
const DEMO_BORROW_AMOUNT = parseEther("10");

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

function parseLoanIdInput(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d{1,78}$/.test(trimmed)) {
    throw new Error("Loan ID must be a whole number.");
  }
  const id = BigInt(trimmed);
  if (id === 0n || id > MAX_UINT256) {
    throw new Error("Loan ID is outside the supported range.");
  }
  return id;
}

function parseAmountInput(value: string, label: string): bigint {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,58})(?:\.\d{1,18})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive amount with up to 18 decimal places.`);
  }
  const parsed = parseEther(trimmed);
  if (parsed === 0n || parsed > MAX_UINT256) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return parsed;
}

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

const PROOF_STORAGE_PREFIX = "credit-passport:proof-state:v1";

function proofStorageKey(address: Address) {
  return `${PROOF_STORAGE_PREFIX}:${address.toLowerCase()}`;
}

function isTransactionHash(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function restoreProofState(address: Address) {
  try {
    const raw = window.localStorage.getItem(proofStorageKey(address));
    if (!raw) return { repayTx: undefined, proof: null };
    const saved = JSON.parse(raw) as { repayTx?: unknown; proof?: unknown };
    const repayTx = isTransactionHash(saved.repayTx) ? saved.repayTx : undefined;
    if (!repayTx || !saved.proof) return { repayTx, proof: null };
    return { repayTx, proof: parsePastableProof(JSON.stringify(saved.proof), repayTx) };
  } catch {
    return { repayTx: undefined, proof: null };
  }
}

function formatAttestationEstimate(remainingBlocks: number) {
  if (remainingBlocks <= 0) return "ready now";
  const seconds = remainingBlocks * 12;
  if (seconds < 60) return `about ${seconds}s`;
  return `about ${Math.ceil(seconds / 60)} min`;
}

function ActiveLoansSkeleton() {
  return (
    <div className="loan-skeletons" aria-hidden="true">
      {["one", "two", "three"].map((row) => (
        <div className="loan-skeleton" key={row}>
          <span className="skeleton-line skeleton-loan-id" />
          <span className="skeleton-line skeleton-loan-debt" />
          <span className="skeleton-line skeleton-loan-principal" />
        </div>
      ))}
    </div>
  );
}

export function Desk() {
  const { address, isConnected, connector } = useAccount();
  const sepoliaClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const creditcoinClient = usePublicClient({ chainId: CREDITCOIN_CHAIN_ID });

  const previousAddress = useRef<string | undefined>(undefined);
  useEffect(() => {
    const walletChanged = previousAddress.current !== address;
    setPersistedForAddress(undefined);

    if (previousAddress.current && walletChanged) {
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

    if (address) {
      const restored = restoreProofState(address);
      if (restored.repayTx) {
        setRepayTx(restored.repayTx);
        setProof(restored.proof);
        if (restored.proof) {
          setPhase("proof_ready");
          setStatus("Restored a ready repayment proof. Submit it on Creditcoin when ready.");
        } else {
          setPhase("waiting_source");
          setStatus("Restored repayment. Resuming proof preparation…");
        }
      }
      setPersistedForAddress(address.toLowerCase());
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
  const [persistedForAddress, setPersistedForAddress] = useState<string>();
  const [creditTx, setCreditTx] = useState<Hex | undefined>();
  const [borrowTx, setBorrowTx] = useState<Hex | undefined>();
  const [corsFallback, setCorsFallback] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [faucetTx, setFaucetTx] = useState<Hex | undefined>();
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [openLoanBusy, setOpenLoanBusy] = useState(false);
  const [repayBusy, setRepayBusy] = useState(false);
  const [borrowBusy, setBorrowBusy] = useState(false);
  const [repayAll, setRepayAll] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [activeLoansBusy, setActiveLoansBusy] = useState(false);
  const [loanRefresh, setLoanRefresh] = useState(0);
  const [verified, setVerified] = useState<{
    score: string;
    cap: string;
    tokenId: string;
    passportScore: string;
  } | null>(null);

  const sepoliaReady = isConfigured(addresses.sepoliaMockMarket);
  const creditReady = isConfigured(addresses.creditPassportAsc);

  useEffect(() => {
    if (!address || persistedForAddress !== address.toLowerCase()) return;

    const key = proofStorageKey(address);
    try {
      if (!repayTx) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(
        key,
        JSON.stringify({ repayTx, proof, savedAt: Date.now() }),
      );
    } catch {
      // Storage is optional; keep the active proof usable in restricted browsers.
    }
  }, [address, persistedForAddress, proof, repayTx]);

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

  const { data: passportScore, refetch: refetchPassportScore } = useReadContract({
    address: addresses.passportNft as Address,
    abi: passportNftAbi,
    functionName: "scoreOfToken",
    args: tokenId && tokenId !== 0n ? [tokenId] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: Boolean(tokenId && tokenId !== 0n) && creditReady },
  });

  const { data: lineBalance } = useReadContract({
    address: addresses.creditMockUsd as Address,
    abi: mockUsdAbi,
    functionName: "balanceOf",
    args: [addresses.creditLine as Address],
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: creditReady },
  });

  useEffect(() => {
    let cancelled = false;
    async function loadActiveLoans() {
      if (!address || !sepoliaClient) {
        setActiveLoans([]);
        setActiveLoansBusy(false);
        return;
      }
      setActiveLoansBusy(true);
      try {
        const opened = await sepoliaClient.getContractEvents({
          address: addresses.sepoliaMockMarket as Address,
          abi: mockMarketAbi,
          eventName: "LoanOpened",
          args: { borrower: address },
        });
        const ids = Array.from(
          new Set(
            opened.flatMap((log) =>
              log.args.loanId === undefined ? [] : [log.args.loanId],
            ),
          ),
        ).slice(-50);
        const loans = [] as {
          id: bigint;
          borrower: Address;
          principal: bigint;
          debt: bigint;
          active: boolean;
        }[];
        for (let index = 0; index < ids.length; index += 10) {
          const batch = await Promise.all(
            ids.slice(index, index + 10).map(async (id) => {
              const [borrower, principal, debt, active] = await sepoliaClient.readContract({
                address: addresses.sepoliaMockMarket as Address,
                abi: mockMarketAbi,
                functionName: "loans",
                args: [id],
              });
              return { id, borrower, principal, debt, active };
            }),
          );
          loans.push(...batch);
        }
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
  }, [address, sepoliaClient, loanRefresh]);

  const activeLoanDebt = useMemo(
    () => activeLoans.reduce((total, loan) => total + loan.debt, 0n),
    [activeLoans],
  );

  const addNetworks = useCallback(async () => {
    try {
      const request = await selectedWalletRequest();
      await addWalletChain(request, sepoliaWalletChain);
      await addWalletChain(request, creditcoinWalletChain);
      setStatus("Sepolia + Creditcoin CC3 added to the selected wallet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [connector]);

  async function selectedWalletRequest() {
    const provider = (await connector?.getProvider()) as
      | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    if (!provider?.request) {
      throw new Error("Wallet connection is no longer available. Reconnect the selected wallet, then retry.");
    }
    return provider.request.bind(provider);
  }

  const updateProofProgress = useCallback((message: string) => {
    if (/confirming sepolia/i.test(message)) {
      setPhase("waiting_source");
    } else if (/waiting for attestation|attestation:/i.test(message)) {
      setPhase("waiting_attestation");
    } else if (/proof|prover|retry|indexing/i.test(message)) {
      setPhase("generating_proof");
    }
    const height = /proof service has (\d+); repayment is in (\d+)/i.exec(message);
    if (height) {
      const remainingBlocks = Math.max(0, Number(height[2]) - Number(height[1]));
      setStatus(
        `Waiting for Attestcoin: ${remainingBlocks} block${remainingBlocks === 1 ? "" : "s"} remaining (${formatAttestationEstimate(remainingBlocks)}).`,
      );
      return;
    }
    setStatus(message);
  }, []);

  async function faucet() {
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    setFaucetBusy(true);
    try {
      if (!sepoliaClient) throw new Error("Sepolia RPC unavailable.");
      const request = await selectedWalletRequest();
      let nextFaucetAt: bigint | undefined;
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
          if (last !== 0n && now < last + 3600n) {
            nextFaucetAt = last + 3600n;
          }
        }
      } catch {
        // Let the transaction surface an RPC or contract error if the cooldown check is unavailable.
      }
      if (nextFaucetAt) {
        const remainingSeconds = Number(nextFaucetAt - BigInt(Math.floor(Date.now() / 1000)));
        throw new Error(`Faucet available again in ${formatAttestationEstimate(Math.ceil(remainingSeconds / 12))}.`);
      }

      setStatus("Confirm the mUSD faucet in Rabby or MetaMask.");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaMockUsd as Address,
        abi: mockUsdAbi,
        functionName: "faucet",
        chain: sepoliaWalletChain,
        request,
      });

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
      if (!address) throw new Error("Connect wallet first.");
      if (!sepoliaClient) throw new Error("Sepolia RPC unavailable.");
      const principal = parseAmountInput(amount || "100", "Loan amount");
      const hash = await sendPopulatedWrite({
        publicClient: sepoliaClient,
        account: address,
        address: addresses.sepoliaMockMarket as Address,
        abi: mockMarketAbi,
        functionName: "openLoan",
        functionArgs: [principal],
        chain: sepoliaWalletChain,
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
      if (!address) throw new Error("Connect wallet first.");
      if (!sepoliaClient) throw new Error("Sepolia RPC unavailable.");
      const request = await selectedWalletRequest();
      const requestedIds = repayAll
        ? activeLoans.map((loan) => loan.id)
        : loanId.trim()
          ? [parseLoanIdInput(loanId)]
          : [];
      if (!requestedIds.length) {
        throw new Error(
          repayAll
            ? "No active loans are available to repay."
            : "Select an active loan or enter its loan ID before repaying.",
        );
      }
      const requestedAmount = repayAll ? 0n : parseAmountInput(amount || "100", "Repayment amount");
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
          chain: sepoliaWalletChain,
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
          chain: sepoliaWalletChain,
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
      setProof(null);
      setRepayTx(lastHash);
      setLoanRefresh((current) => current + 1);
      setStatus(
        `${currentLoans.length === 1 ? "Repayment" : "All repayments"} confirmed. Preparing the proof for Creditcoin…`,
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
    if (!address) throw new Error("Connect wallet first.");
    if (!creditcoinClient) throw new Error("Creditcoin RPC unavailable.");
    const hash = await sendPopulatedWrite({
      publicClient: creditcoinClient,
      account: address,
      address: addresses.creditPassportAsc as Address,
      abi: passportAscAbi,
      functionName: "proveRepayment",
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
    setCreditTx(hash);
    setStatus("Waiting for Creditcoin confirmation and current Passport credentials…");
    const receipt = await creditcoinClient.waitForTransactionReceipt({
      hash,
      timeout: 120_000,
    });
    if (receipt.status === "reverted") {
      throw new Error("proveRepayment reverted on Creditcoin.");
    }
    const [latestScore, latestCap, latestTokenId] = await Promise.all([
      creditcoinClient.readContract({
        address: addresses.creditScore as Address,
        abi: creditScoreAbi,
        functionName: "scoreOf",
        args: [address],
        blockNumber: receipt.blockNumber,
      }),
      creditcoinClient.readContract({
        address: addresses.creditLine as Address,
        abi: creditLineAbi,
        functionName: "borrowCapOf",
        args: [address],
        blockNumber: receipt.blockNumber,
      }),
      creditcoinClient.readContract({
        address: addresses.passportNft as Address,
        abi: passportNftAbi,
        functionName: "tokenOf",
        args: [address],
        blockNumber: receipt.blockNumber,
      }),
    ]);
    const latestPassportScore =
      latestTokenId === 0n
        ? 0n
        : await creditcoinClient.readContract({
            address: addresses.passportNft as Address,
            abi: passportNftAbi,
            functionName: "scoreOfToken",
            args: [latestTokenId],
            blockNumber: receipt.blockNumber,
          });
    await Promise.all([refetchScore(), refetchCap(), refetchToken(), refetchPassportScore()]);
    setPhase("verified");
    setVerified({
      score: latestScore.toString(),
      cap: formatEther(latestCap),
      tokenId: latestTokenId.toString(),
      passportScore: latestPassportScore.toString(),
    });
    setStatus(`Verified on Creditcoin. Latest Passport credentials loaded. Tx ${hash}`);
    setCorsFallback(false);
  }

  useEffect(() => {
    if (
      !repayTx ||
      proof?.sepoliaTxHash.toLowerCase() === repayTx.toLowerCase()
    ) {
      return;
    }

    let cancelled = false;
    setCorsFallback(false);
    setPhase("waiting_source");
    setStatus("Preparing repayment proof…");

    void buildProof(repayTx, (message) => {
      if (!cancelled) updateProofProgress(message);
    })
      .then((payload) => {
        if (cancelled) return;
        setProof(payload);
        setPhase("proof_ready");
        setStatus("Proof ready. Confirm the Creditcoin transaction to finish verification.");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPhase("error");
        if (err instanceof ProveCorsError) {
          setCorsFallback(true);
          setStatus(
            "Browser cannot reach the proof service. Use the CLI fallback panel below, then paste the proof JSON.",
          );
          return;
        }
        setStatus(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [proof?.sepoliaTxHash, repayTx, updateProofProgress]);

  async function proveOnCreditcoin() {
    if (!repayTx) {
      setStatus("Repay on Sepolia first so we have a LoanRepaid tx hash.");
      setPhase("error");
      return;
    }
    try {
      setCorsFallback(false);
      if (proof && proof.sepoliaTxHash.toLowerCase() === repayTx.toLowerCase()) {
        await submitProveRepayment(proof);
        return;
      }
      setPhase("waiting_source");
      setStatus("Confirming Sepolia repayment…");
      setPhase("waiting_attestation");
      setStatus(
        "Waiting for Attestcoin height attestation (~15s+ lag; can take minutes)…",
      );
      setPhase("generating_proof");

      const payload = await buildProof(repayTx, updateProofProgress);
      setProof(payload);
      await submitProveRepayment(payload);
    } catch (err: unknown) {
      if (err instanceof ProveCorsError) {
        setCorsFallback(true);
        setPhase("error");
        setStatus(
          "Browser cannot reach the proof service. Use the CLI fallback panel below, then paste the proof JSON.",
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
        throw new Error("The proof file is incomplete. Create it again from the manual verification guide.");
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
    if (borrowBusy) return;
    setBorrowBusy(true);
    try {
      if (!address) throw new Error("Connect wallet first.");
      if (!creditcoinClient) throw new Error("Creditcoin RPC unavailable.");
      if (lineBalance !== undefined && lineBalance < DEMO_BORROW_AMOUNT) {
        setStatus(
          "The demo credit pool needs refilling. Please try again later.",
        );
        setPhase("error");
        return;
      }
      const hash = await sendPopulatedWrite({
        publicClient: creditcoinClient,
        account: address,
        address: addresses.creditLine as Address,
        abi: creditLineAbi,
        functionName: "borrow",
        functionArgs: [DEMO_BORROW_AMOUNT],
        chain: creditcoinWalletChain,
        request: await selectedWalletRequest(),
      });
      setBorrowTx(hash);
      setStatus(`Borrowed 10 mUSD on Creditcoin. Tx ${hash}`);
      await refetchCap();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/transfer|insufficient|exceeds balance|ERC20/i.test(msg)) {
        setStatus(
          "The demo credit pool needs refilling. Please try again later.",
        );
      } else {
        setStatus(msg);
      }
      setPhase("error");
    } finally {
      setBorrowBusy(false);
    }
  }

  const statusTone = useMemo(() => {
    if (phase === "verified" || phase === "proof_ready") return "success";
    if (
      phase === "error" ||
      /(?:error|failed|reverted|unavailable|cannot|no active|need |outside|belongs to)/i.test(
        status,
      )
    ) {
      return "danger";
    }
    if (
      phase === "waiting_source" ||
      phase === "waiting_attestation" ||
      phase === "generating_proof" ||
      phase === "submitting" ||
      faucetBusy ||
      openLoanBusy ||
      repayBusy ||
      borrowBusy
    ) {
      return "progress";
    }
    return "info";
  }, [borrowBusy, faucetBusy, openLoanBusy, phase, repayBusy, status]);

  const statusLabel = useMemo(() => {
    if (statusTone === "success") return "Complete";
    if (statusTone === "danger") return "Action needed";
    if (statusTone === "progress") return "In progress";
    return "Status";
  }, [statusTone]);

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
    phase === "waiting_source" ||
    phase === "generating_proof" ||
    phase === "waiting_attestation" ||
    phase === "submitting";
  const loanActionBusy = faucetBusy || openLoanBusy || repayBusy;

  const passportTokenId =
    tokenId !== undefined && tokenId !== 0n
      ? tokenId.toString()
      : verified?.tokenId && verified.tokenId !== "refresh" && verified.tokenId !== "0"
        ? verified.tokenId
        : null;

  const journey = !isConnected
    ? {
        eyebrow: "Start here",
        title: "Build your first credit record",
        body: "Connect the wallet you want to use. We will guide you through a short testnet repayment and turn it into a portable credit credential.",
      }
    : activeLoansBusy
      ? {
          eyebrow: "Getting ready",
          title: "Checking your credit journey",
          body: "We are finding any open demo loans linked to this wallet.",
        }
      : !repayTx && activeLoans.length === 0
        ? {
            eyebrow: "Your next step",
            title: "Get your first demo loan",
            body: "Use the guided actions below to receive test funds, open a small loan, and repay it. No real money is involved.",
          }
        : !repayTx
          ? {
              eyebrow: "Your next step",
              title: "Repay your open demo loan",
              body: "Choose the loan below, then repay it to begin your verification.",
            }
          : phase !== "verified"
            ? {
                eyebrow: "Almost there",
                title: "Verify your repayment",
                body: "Your repayment is ready. We will verify it and add it to your Credit Passport.",
              }
            : {
                eyebrow: "Credit unlocked",
                title: "Your Credit Passport is ready",
                body: "Your verified repayment is now part of your portable credit record.",
              };

  return (
    <main className="desk">
      <header className="desk-top">
        <div className="desk-top-brand">
          <Link href="/" className="desk-home">
            Your Credit Passport
          </Link>
          <p className="desk-top-lede">
            A simple path from a repaid demo loan to a verified credit record.
          </p>
        </div>
      </header>

      <section className="journey-card" aria-labelledby="journey-title">
        <p className="journey-kicker">{journey.eyebrow}</p>
        <h1 id="journey-title">{journey.title}</h1>
        <p>{journey.body}</p>
        {!isConnected ? (
          <div className="journey-actions">
            <ConnectButton />
            <button type="button" className="btn btn-ghost" onClick={() => void addNetworks()}>
              Set up test networks
            </button>
          </div>
        ) : null}
      </section>

      <ol className="rail" aria-label="Your credit journey">
        <li className="rail-step" data-state={step1State}>
          <span className="rail-index">01</span>
          <span className="rail-label">Get a demo loan</span>
        </li>
        <li className="rail-step" data-state={step2State}>
          <span className="rail-index">02</span>
          <span className="rail-label">Verify repayment</span>
        </li>
        <li className="rail-step" data-state={step3State}>
          <span className="rail-index">03</span>
          <span className="rail-label">See your credit</span>
        </li>
      </ol>

      {!sepoliaReady || !creditReady ? (
        <section className="alert" role="alert">
          <h2>Demo temporarily unavailable</h2>
          <p>
            This test page cannot reach all of its required services. <Link href="/docs">Read the setup guide</Link>.
          </p>
        </section>
      ) : null}

      <section className="section" aria-labelledby="step-sepolia">
        <div className="section-head">
          <h2 id="step-sepolia">Get a demo loan</h2>
          <span className="section-kicker">Step 01</span>
        </div>
        <p>Get demo funds, open a small loan, then repay it. This is a test flow and uses no real money.</p>
        <p className="tx-line mono">
          Sepolia mUSD{" "}
          {musd !== undefined ? Number(formatEther(musd)).toLocaleString() : "—"}
        </p>
        <div className="loan-dashboard" aria-busy={activeLoansBusy} aria-describedby="active-loans-help">
          <div className="loan-dashboard-head">
            <div>
              <span className="loan-dashboard-label">Active loans</span>
              <strong>
                {activeLoansBusy
                  ? "Loading loans"
                  : activeLoans.length
                    ? `${activeLoans.length} open`
                    : "No open loans"}
              </strong>
            </div>
            {activeLoans.length ? (
              <span className="loan-total">{formatEther(activeLoanDebt)} mUSD due</span>
            ) : null}
          </div>
          <p className="sr-only" id="active-loans-help" role="status">
            {activeLoansBusy
              ? "Loading active loans from Sepolia."
              : activeLoans.length
                ? "Choose a loan to fill in its repayment details, or repay every active loan."
                : "Open a loan to continue with a repayment."}
          </p>
          {activeLoansBusy ? <ActiveLoansSkeleton /> : null}
          {!activeLoansBusy && activeLoans.length ? (
            <div className="loan-list" role="group" aria-label="Choose an active loan to repay">
              {activeLoans.map((loan) => {
                const selected = loanId === loan.id.toString() && !repayAll;
                return (
                  <button
                    key={loan.id.toString()}
                    type="button"
                    className="loan-row"
                    aria-pressed={selected}
                    disabled={loanActionBusy}
                    onClick={() => {
                      setRepayAll(false);
                      setLoanId(loan.id.toString());
                      setAmount(formatEther(loan.debt));
                    }}
                  >
                    <span className="loan-row-id">Loan #{loan.id}</span>
                    <span className="loan-row-debt">{formatEther(loan.debt)} mUSD due</span>
                    <span className="loan-row-principal">{formatEther(loan.principal)} mUSD opened</span>
                    <span className="loan-row-selection">{selected ? "Selected" : "Select"}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <label className="loan-toggle">
            <input
              type="checkbox"
              checked={repayAll}
              disabled={!activeLoans.length || loanActionBusy}
              onChange={(event) => setRepayAll(event.target.checked)}
            />
            <span>Repay all active loans</span>
            {repayAll ? <small>{formatEther(activeLoanDebt)} mUSD across {activeLoans.length} loans</small> : null}
          </label>
        </div>
        <fieldset className="loan-fields" disabled={repayAll}>
          <legend>Repayment details</legend>
          <p id="repayment-help" className="field-help">
            Select an active loan above or enter its ID. The repayment amount cannot exceed its outstanding balance.
          </p>
          <div className="field-row">
            <label className="field-label" htmlFor="repayment-amount">
              <span>Amount (mUSD)</span>
              <input
                id="repayment-amount"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                aria-describedby="repayment-help"
              />
            </label>
            <label className="field-label" htmlFor="repayment-loan-id">
              <span>Loan ID</span>
              <input
                id="repayment-loan-id"
                className="input"
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                inputMode="numeric"
                aria-describedby="repayment-help"
              />
            </label>
          </div>
        </fieldset>
        <div className="actions loan-actions">
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady || loanActionBusy}
            onClick={() => void faucet().catch((e: unknown) => setStatus(e instanceof Error ? e.message : String(e)))}
          >
            {faucetBusy ? "Confirm in wallet…" : "Get demo funds"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!isConnected || !sepoliaReady || loanActionBusy}
            onClick={() => void openLoan()}
          >
            {openLoanBusy ? "Confirm in wallet…" : "Open 100 mUSD loan"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !sepoliaReady || loanActionBusy}
            onClick={() => void repayLoan()}
          >
            {repayBusy ? "Confirming repayment…" : "Repay selected loan"}
          </button>
        </div>
        {faucetTx ? (
          <p className="tx-line mono">
            Demo funds receipt:{" "}
            <a href={`${SEPOLIA_EXPLORER}/tx/${faucetTx}`} target="_blank" rel="noreferrer">
              {faucetTx}
            </a>
          </p>
        ) : null}
        {repayTx ? (
          <p className="tx-line mono">
            Repayment receipt:{" "}
            <a href={`${SEPOLIA_EXPLORER}/tx/${repayTx}`} target="_blank" rel="noreferrer">
              {repayTx}
            </a>
          </p>
        ) : null}
      </section>

      <section className="section" aria-labelledby="step-prove">
        <div className="section-head">
          <h2 id="step-prove">Verify your repayment</h2>
          <span className="section-kicker">Step 02</span>
        </div>
        <p>We will confirm your repayment and add it to your Credit Passport.</p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isConnected || !creditReady || !repayTx || proveBusy}
            onClick={() => void proveOnCreditcoin()}
          >
            {proveBusy
              ? "Preparing proof…"
              : phase === "proof_ready"
                ? "Submit proof to Creditcoin"
                : "Verify repayment"}
          </button>
        </div>
        <p
          className="status"
          data-tone={statusTone}
          role={statusTone === "danger" ? "alert" : "status"}
          aria-live={statusTone === "danger" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <strong>{statusLabel}</strong>
          <span>{status}</span>
        </p>
        {creditTx ? (
          <p className="tx-line mono">
            Verification receipt:{" "}
            <a href={`${CREDITCOIN_EXPLORER}/tx/${creditTx}`} target="_blank" rel="noreferrer">
              {creditTx}
            </a>
          </p>
        ) : null}

        {corsFallback ? (
          <div className="cors-panel" aria-labelledby="cli-fallback-title">
            <h2 id="cli-fallback-title">Finish verification manually</h2>
            <p>
              Automatic verification is unavailable right now. Follow the manual verification guide,
              then paste the proof file here.
            </p>
            <p><Link href="/docs#manual-verification">Open the manual verification guide</Link></p>
            <textarea
              id="pasted-proof"
              className="input"
              placeholder="Paste the proof file from the guide"
              value={pasteJson}
              onChange={(e) => setPasteJson(e.target.value)}
              aria-label="Proof JSON"
              aria-describedby="cli-fallback-help"
            />
            <p id="cli-fallback-help" className="sr-only">
              Paste the complete proof JSON generated by the command above.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!isConnected || !creditReady || !pasteJson.trim() || proveBusy}
                onClick={() => void submitPastedProof()}
              >
                Submit verification
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section" aria-labelledby="step-unlock">
        <div className="section-head">
          <h2 id="step-unlock">See your credit</h2>
          <span className="section-kicker">Step 03</span>
        </div>
        <p>Once verified, your Credit Passport and demo borrowing limit appear here.</p>
        <p className="credit-pool-note" data-ready={lineBalance !== undefined && lineBalance >= DEMO_BORROW_AMOUNT}>
          {lineBalance === undefined
            ? "Checking whether the demo credit pool is ready..."
            : lineBalance >= DEMO_BORROW_AMOUNT
              ? "Demo credit pool ready for a 10 mUSD borrow."
              : "The demo credit pool is being refilled. Try again shortly."}
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !isConnected ||
              !creditReady ||
              phase !== "verified" ||
              borrowBusy ||
              lineBalance === undefined ||
              lineBalance < DEMO_BORROW_AMOUNT
            }
            onClick={() => void borrowOnCreditcoin()}
          >
            {borrowBusy ? "Confirm in wallet..." : "Borrow 10 mUSD (demo)"}
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

        {passportTokenId ? (
          <article className="passport-credential" aria-labelledby="passport-credential-title">
            <div className="passport-art">
              <Image
                src="/credit-passport-credential.png"
                alt=""
                width={900}
                height={1125}
                sizes="(max-width: 800px) 100vw, 15rem"
              />
            </div>
            <div className="passport-credential-copy">
              <p className="passport-eyebrow">Verified credential</p>
              <h3 id="passport-credential-title">Credit Passport</h3>
              <p>
                A repayment attested from Sepolia has issued this non-transferable credit credential on Creditcoin.
              </p>
              <dl className="passport-details">
                <dt>Passport</dt>
                <dd>#{passportTokenId}</dd>
                <dt>Holder</dt>
                <dd>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected wallet"}</dd>
                <dt>Score</dt>
                <dd>{passportScore !== undefined ? passportScore.toString() : verified?.passportScore ?? "-"}</dd>
                <dt>Borrow cap</dt>
                <dd>{cap !== undefined ? `${formatEther(cap)} mUSD` : verified?.cap ?? "-"}</dd>
              </dl>
            </div>
          </article>
        ) : null}

        <p className="app-docs-link">
          Need transaction records or technical details? <Link href="/docs">Read the documentation</Link>.
        </p>
      </section>

    </main>
  );
}
