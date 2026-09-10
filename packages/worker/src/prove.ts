/**
 * Credit Passport proof CLI
 *
 * Usage:
 *   npm run prove -- <sepoliaTxHash> [--agent|--aave] [--submit] [--claim 0xAddress] [--json-out path]
 */

import {
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isHexString,
  dataSlice,
  toUtf8String,
} from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import { loadEnv } from "./env.js";

const ASC_DEFAULT = "0x5123CdFd395414FcB6c5b8bc10A0843882EfD277";
const AGENT_ASC_DEFAULT = "0x965bdfEcD8ac53885d1d899E99814Af2752E16C8";
const PROVER_FALLBACK = "https://proof-gen-api.cc3-testnet.creditcoin.network";
const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
const CREDITCOIN_EXPLORER = "https://creditcoin-testnet.blockscout.com";

const ASC_ABI = [
  "function proveRepayment(uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots,address claimBorrower) returns (bool)",
  "function proveAaveRepayment(uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots,address claimBorrower) returns (bool)",
  "function proveJobCompletion(uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots,address claimAgent) returns (bool)",
  "error WrongChainKey(uint64 got)",
  "error ProofFailed()",
  "error QueryAlreadyProcessed(bytes32 queryId)",
  "error TxFailed()",
  "error BadTarget(address got)",
  "error BadCalldata()",
  "error NotFullVariableRepayment()",
  "error AssetMismatch(address eventAsset,address calldataAsset)",
  "error NoAaveRepayLog()",
  "error BadTopics()",
  "error EmptyRepayment()",
  "error UnsupportedATokenRepayment()",
  "error NoLoanRepaidLog()",
  "error BadEmitter(address got)",
  "error BorrowerMismatch(address logBorrower, address claimer)",
  "error BadTopics()",
] as const;

type MerkleSibling = { hash: string; isLeft: boolean };

type ProofLike = {
  success?: boolean;
  chainKey: number | bigint;
  headerNumber: number | bigint;
  txIndex?: number | bigint;
  txBytes: string;
  merkleProof: { root: string; siblings: MerkleSibling[] };
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
  cached?: boolean;
};

function usage(): never {
  console.error(
    "Usage: npm run prove -- <sepoliaTxHash> [--agent|--aave] [--submit] [--claim 0xAddress] [--json-out path]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const txHash = argv[0];
  if (!txHash || !isHexString(txHash, 32)) usage();
  let submit = false;
  let agent = false;
  let aave = false;
  let claim = "0x0000000000000000000000000000000000000000";
  let jsonOut: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--submit") submit = true;
    else if (a === "--agent") agent = true;
    else if (a === "--aave") aave = true;
    else if (a === "--claim") {
      claim = argv[++i] ?? usage();
      getAddress(claim);
    } else if (a === "--json-out") {
      jsonOut = argv[++i];
    } else {
      usage();
    }
  }
  if (agent && aave) usage();
  return { txHash, submit, agent, aave, claim, jsonOut };
}

function decodeRevert(err: unknown): string {
  const iface = new Interface(ASC_ABI);
  const anyErr = err as {
    data?: string;
    info?: { error?: { data?: string } };
    shortMessage?: string;
    message?: string;
    reason?: string;
  };
  const data =
    anyErr?.data ??
    anyErr?.info?.error?.data ??
    (typeof anyErr?.message === "string" && anyErr.message.match(/0x[0-9a-fA-F]+/)?.[0]);
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        return `${parsed.name}(${parsed.args.map(String).join(", ")})`;
      }
    } catch {
      /* fall through */
    }
    // Panic / Error(string)
    try {
      if (data.startsWith("0x08c379a0")) {
        const reason = toUtf8String(dataSlice(data, 4 + 32 + 32));
        return `Error(${reason})`;
      }
    } catch {
      /* fall through */
    }
  }
  return anyErr?.shortMessage ?? anyErr?.reason ?? anyErr?.message ?? String(err);
}

async function fetchProof(
  chainKey: number,
  proofUrl: string,
  blockNumber: number,
  txHash: string,
): Promise<ProofLike> {
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofUrl, 5_000);
  console.log(`Waiting until height ${blockNumber} is attested via ${proofUrl}…`);
  await proofBuilder.waitUntilHeightAttested(chainKey, blockNumber, 15_000, 1_200_000);

  let lastError = "missing data";
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`getProof attempt ${attempt}/5…`);
    const result = await proofBuilder.getProof(txHash);
    if (result.success && result.data) {
      return result.data as ProofLike;
    }
    lastError = result.error ?? "missing data";
    console.warn(`ProofBuilder success=${result.success} error=${lastError}`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`ProofBuilder failed after retries: ${lastError}`);
}

async function main(): Promise<void> {
  const { txHash, submit, agent, aave, claim, jsonOut } = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  const sourceProvider = new JsonRpcProvider(env.SEPOLIA_RPC_URL);
  const creditcoinProvider = new JsonRpcProvider(env.CREDITCOIN_RPC_URL);
  const chainKey = env.SEPOLIA_CHAIN_KEY;
  let asc: string;
  if (agent) {
    asc = env.CREDITCOIN_AGENT_PASSPORT_ASC ?? AGENT_ASC_DEFAULT;
  } else if (aave) {
    if (!env.CREDITCOIN_AAVE_PASSPORT_ASC) {
      throw new Error("CREDITCOIN_AAVE_PASSPORT_ASC is required for --aave.");
    }
    asc = env.CREDITCOIN_AAVE_PASSPORT_ASC;
  } else {
    asc = env.CREDITCOIN_PASSPORT_ASC ?? ASC_DEFAULT;
  }
  const proveFunction = agent ? "proveJobCompletion" : aave ? "proveAaveRepayment" : "proveRepayment";
  const claimField = agent ? "claimAgent" : "claimBorrower";

  const info = new chainInfo.PrecompileChainInfoProvider(
    creditcoinProvider as unknown as ConstructorParameters<
      typeof chainInfo.PrecompileChainInfoProvider
    >[0],
  );
  const supported = await info.getSupportedChains();
  console.log("Supported Attestcoin chains:", supported);
  const hasSepolia = Array.isArray(supported)
    ? supported.some((c: { chainKey?: number | bigint } | number | bigint) => {
        if (typeof c === "number" || typeof c === "bigint") return Number(c) === chainKey;
        return Number(c.chainKey) === chainKey;
      })
    : false;
  if (!hasSepolia) {
    throw new Error(
      `Sepolia chainKey ${chainKey} missing from getSupportedChains(). Check CC3 testnet / RPC.`,
    );
  }

  console.log(`Waiting for Sepolia tx ${txHash}…`);
  const receipt = await sourceProvider.waitForTransaction(txHash, 1, 180_000);
  if (!receipt?.blockNumber) {
    throw new Error(`Transaction ${txHash} not mined on Sepolia`);
  }
  const blockNumber = receipt.blockNumber;
  console.log(`Mined in Sepolia block ${blockNumber} (status=${receipt.status})`);
  if (receipt.status !== 1) {
    throw new Error(
      "Source tx failed (status != 1). Attestcoin would still prove inclusion — ASC rejects it.",
    );
  }

  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`Latest attested height for chainKey ${chainKey}:`, latest);

  const proverUrls = [env.PROOF_BUILDER_URL, PROVER_FALLBACK].filter(
    (u, i, arr) => Boolean(u) && arr.indexOf(u) === i,
  );

  let proof: ProofLike | undefined;
  let lastErr: unknown;
  for (const url of proverUrls) {
    try {
      proof = await fetchProof(chainKey, url, blockNumber, txHash);
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`Prover ${url} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!proof) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
  if (!proof.txBytes || !proof.merkleProof || !proof.continuityProof) {
    throw new Error("ProofBuilder response missing txBytes / merkleProof / continuityProof");
  }

  const iface = new Interface(ASC_ABI);
  const chainKeyOut = Number(proof.chainKey ?? chainKey);
  const headerNumber = Number(proof.headerNumber);
  const siblingsTuples = proof.merkleProof.siblings.map((s) => {
    const entry = s as MerkleSibling & { hash?: string; isLeft?: boolean };
    return [entry.hash, Boolean(entry.isLeft)] as [string, boolean];
  });
  const calldata = iface.encodeFunctionData(proveFunction, [
    chainKeyOut,
    headerNumber,
    proof.txBytes,
    proof.merkleProof.root,
    siblingsTuples,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots,
    claim,
  ]);

  /** Canonical proof document — same flat shape Desk paste expects (ADR-0003). */
  const proofDocument = {
    sepoliaTxHash: txHash,
    sepoliaBlockNumber: blockNumber,
    chainKey: chainKeyOut,
    headerNumber,
    txIndex: Number(proof.txIndex ?? 0),
    merkleRoot: proof.merkleProof.root,
    siblings: proof.merkleProof.siblings.map((s) => ({
      hash: s.hash,
      isLeft: Boolean(s.isLeft),
    })),
    lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
    continuityRoots: proof.continuityProof.roots,
    txBytes: proof.txBytes,
    cached: Boolean(proof.cached),
    [claimField]: claim,
    asc,
    [`${proveFunction}Calldata`]: calldata,
  };

  console.log(JSON.stringify(proofDocument, null, 2));

  if (jsonOut) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(jsonOut, JSON.stringify(proofDocument, null, 2));
    console.log(`Wrote flat proof document ${jsonOut}`);
  }

  if (submit) {
    const pk = env.CREDITCOIN_PRIVATE_KEY;
    if (!pk) throw new Error("CREDITCOIN_PRIVATE_KEY required for --submit");
    const wallet = new Wallet(pk, creditcoinProvider);
    console.log(`Submitting ${proveFunction} from ${wallet.address} → ${asc}`);
    try {
      const tx = await wallet.sendTransaction({ to: asc, data: calldata });
      console.log(`Creditcoin tx: ${tx.hash}`);
      const conf = await tx.wait();
      console.log(`Confirmed in block ${conf?.blockNumber}`);
      console.log(`
======== ${agent ? "AGENT PASSPORT" : aave ? "AAVE REPAYMENT" : "HACKATHON"} PROOF ========
Sepolia ${agent ? "JobCompleted" : aave ? "Aave full repayment" : "LoanRepaid"} tx:  ${SEPOLIA_EXPLORER}/tx/${txHash}
Creditcoin ${proveFunction} tx: ${CREDITCOIN_EXPLORER}/tx/${tx.hash}
ASC: ${asc}
${claimField}: ${claim}
chainKey: ${proofDocument.chainKey}
headerNumber: ${proofDocument.headerNumber}
=================================
`);
    } catch (err) {
      const decoded = decodeRevert(err);
      console.error(`${proveFunction} reverted: ${decoded}`);
      throw err;
    }
  } else {
    console.log(
      "Calldata ready. Re-run with --submit once CREDITCOIN_PRIVATE_KEY is set.",
    );
    console.log(`
======== ${agent ? "AGENT PASSPORT" : aave ? "AAVE REPAYMENT" : "HACKATHON"} PROOF (proof only — not submitted) ========
Sepolia ${agent ? "JobCompleted" : aave ? "Aave full repayment" : "LoanRepaid"} tx:  ${SEPOLIA_EXPLORER}/tx/${txHash}
Creditcoin ${proveFunction} tx: TBD (run with --submit)
ASC: ${asc}
==============================================================
`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("prove failed:", message);
  process.exit(1);
});
