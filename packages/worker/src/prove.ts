/**
 * Credit Passport proof CLI
 *
 * Usage:
 *   pnpm prove -- <sepoliaTxHash> [--submit] [--claim 0xBorrower]
 *
 * Flow (official Attestcoin readability path):
 *   1. wait for Sepolia receipt
 *   2. waitUntilHeightAttested(chainKey=1, blockNumber)
 *   3. ProofBuilder.getProof(txHash)
 *   4. ABI-encode CreditPassportASC.proveRepayment(...)
 *   5. optionally broadcast on Creditcoin (requires CREDITCOIN_PRIVATE_KEY)
 */

import { Interface, JsonRpcProvider, Wallet, getAddress, isHexString } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import { loadEnv } from "./env.js";

const ASC_ABI = [
  "function proveRepayment(uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots,address claimBorrower) returns (bool)",
] as const;

type MerkleSibling = { hash: string; isLeft: boolean };

type ProofLike = {
  success?: boolean;
  chainKey: number | bigint;
  headerNumber: number | bigint;
  txBytes: string;
  merkleProof: { root: string; siblings: MerkleSibling[] };
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
};

function usage(): never {
  console.error(
    "Usage: pnpm prove -- <sepoliaTxHash> [--submit] [--claim 0xAddress] [--json-out path]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const txHash = argv[0];
  if (!txHash || !isHexString(txHash, 32)) usage();
  let submit = false;
  let claim = "0x0000000000000000000000000000000000000000";
  let jsonOut: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--submit") submit = true;
    else if (a === "--claim") {
      claim = argv[++i] ?? usage();
      getAddress(claim);
    } else if (a === "--json-out") {
      jsonOut = argv[++i];
    } else {
      usage();
    }
  }
  return { txHash, submit, claim, jsonOut };
}

async function main(): Promise<void> {
  const { txHash, submit, claim, jsonOut } = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  // Duplicate ethers type identities across workspaces — cast through unknown.
  const sourceProvider = new JsonRpcProvider(env.SEPOLIA_RPC_URL);
  const creditcoinProvider = new JsonRpcProvider(env.CREDITCOIN_RPC_URL);
  const chainKey = env.SEPOLIA_CHAIN_KEY;

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
    throw new Error("Source tx failed (status != 1). Attestcoin would still prove inclusion — ASC rejects it.");
  }

  const proofBuilder = new proofProvider.service.ProofBuilder(
    chainKey,
    env.PROOF_BUILDER_URL,
    5_000,
  );

  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`Latest attested height for chainKey ${chainKey}:`, latest);

  console.log(
    `Waiting until height ${blockNumber} is attested (~15s lag after attestation is expected)…`,
  );
  await proofBuilder.waitUntilHeightAttested(chainKey, blockNumber, 15_000, 1_200_000);

  console.log("Fetching Merkle + continuity proof…");
  let result = await proofBuilder.getProof(txHash);
  if (!result.success || !result.data) {
    console.warn(
      `ProofBuilder success=${result.success} error=${result.error ?? "n/a"} — retrying once after 10s…`,
    );
    await new Promise((r) => setTimeout(r, 10_000));
    result = await proofBuilder.getProof(txHash);
  }
  if (!result.success || !result.data) {
    throw new Error(
      `ProofBuilder failed: ${result.error ?? "missing data"}. Check dashboard attestation for this height.`,
    );
  }
  const proof: ProofLike = result.data;
  if (!proof.txBytes || !proof.merkleProof || !proof.continuityProof) {
    throw new Error("ProofBuilder response missing txBytes / merkleProof / continuityProof");
  }

  const iface = new Interface(ASC_ABI);
  const siblings = proof.merkleProof.siblings.map((s) => {
    const entry = s as MerkleSibling & { hash?: string; isLeft?: boolean };
    return [entry.hash, Boolean(entry.isLeft)] as [string, boolean];
  });
  const calldata = iface.encodeFunctionData("proveRepayment", [
    Number(proof.chainKey ?? chainKey),
    Number(proof.headerNumber),
    proof.txBytes,
    proof.merkleProof.root,
    siblings,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots,
    claim,
  ]);

  const payload = {
    sepoliaTxHash: txHash,
    sepoliaBlockNumber: blockNumber,
    chainKey: Number(proof.chainKey ?? chainKey),
    headerNumber: Number(proof.headerNumber),
    claimBorrower: claim,
    proof,
    proveRepaymentCalldata: calldata,
    asc: env.CREDITCOIN_PASSPORT_ASC ?? null,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (jsonOut) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(jsonOut, JSON.stringify(payload, null, 2));
    console.log(`Wrote ${jsonOut}`);
  }

  if (submit) {
    const pk = process.env.CREDITCOIN_PRIVATE_KEY;
    const asc = env.CREDITCOIN_PASSPORT_ASC;
    if (!pk) throw new Error("CREDITCOIN_PRIVATE_KEY required for --submit");
    if (!asc) throw new Error("CREDITCOIN_PASSPORT_ASC required for --submit");
    const wallet = new Wallet(pk, creditcoinProvider);
    console.log(`Submitting proveRepayment from ${wallet.address} → ${asc}`);
    const tx = await wallet.sendTransaction({ to: asc, data: calldata });
    console.log(`Creditcoin tx: ${tx.hash}`);
    const conf = await tx.wait();
    console.log(`Confirmed in block ${conf?.blockNumber}`);
  } else {
    console.log(
      "Calldata ready. Pass to the web UI wallet, or re-run with --submit once CREDITCOIN_PRIVATE_KEY + CREDITCOIN_PASSPORT_ASC are set.",
    );
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("prove failed:", message);
  process.exit(1);
});
