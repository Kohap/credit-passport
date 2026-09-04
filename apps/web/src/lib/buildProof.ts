import { JsonRpcProvider, isHexString } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import type { Hex } from "viem";
import {
  CREDITCOIN_RPC,
  PROOF_BUILDER_URL,
  PROOF_BUILDER_URL_FALLBACK,
  SEPOLIA_CHAIN_KEY,
} from "@/config/networks";

export type ProofPayload = {
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
  cached: boolean;
};

export class ProveCorsError extends Error {
  readonly sepoliaTxHash: string;
  constructor(sepoliaTxHash: string, cause?: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause ?? "");
    super(
      detail
        ? `Browser blocked the proof builder (CORS/network): ${detail}`
        : "Browser blocked the proof builder (CORS/network)",
    );
    this.name = "ProveCorsError";
    this.sepoliaTxHash = sepoliaTxHash;
  }
}

function looksLikeCors(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cors|failed to fetch|networkerror|load failed|access-control/i.test(msg);
}

async function getProofWithRetries(
  proofBuilder: InstanceType<typeof proofProvider.service.ProofBuilder>,
  txHash: string,
  attempts: number,
  onStatus?: (msg: string) => void,
) {
  let lastError: string | undefined;
  for (let i = 0; i < attempts; i++) {
    onStatus?.(
      i === 0
        ? "Generating Merkle + continuity proof…"
        : `Retrying getProof (${i + 1}/${attempts})…`,
    );
    const result = await proofBuilder.getProof(txHash);
    if (result.success && result.data) return result;
    lastError = result.error ?? "missing data";
    await new Promise((r) => setTimeout(r, 8_000));
  }
  throw new Error(lastError ?? "proof generation failed");
}

/**
 * Build an Attestcoin proof in the browser (GitHub Pages has no Node API routes).
 * Tries primary prover, then fallback. Throws ProveCorsError on browser CORS blocks.
 */
export async function buildProof(
  txHash: string,
  onStatus?: (msg: string) => void,
): Promise<ProofPayload> {
  if (!isHexString(txHash, 32)) {
    throw new Error("invalid Sepolia tx hash");
  }

  const sepoliaRpc =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
    "https://ethereum-sepolia-rpc.publicnode.com";
  const creditcoinRpc =
    process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? CREDITCOIN_RPC;
  const primary =
    process.env.NEXT_PUBLIC_PROOF_BUILDER_URL ?? PROOF_BUILDER_URL;
  const fallback =
    process.env.NEXT_PUBLIC_PROOF_BUILDER_URL_FALLBACK ??
    PROOF_BUILDER_URL_FALLBACK;
  const chainKey = Number(
    process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_KEY ?? SEPOLIA_CHAIN_KEY,
  );

  try {
    const source = new JsonRpcProvider(sepoliaRpc);
    const creditcoin = new JsonRpcProvider(creditcoinRpc);
    const info = new chainInfo.PrecompileChainInfoProvider(
      creditcoin as unknown as ConstructorParameters<
        typeof chainInfo.PrecompileChainInfoProvider
      >[0],
    );

    onStatus?.("Checking Attestcoin supported chains…");
    const supported = await info.getSupportedChains();
    if (!supported.some((c) => c.chainKey === chainKey)) {
      throw new Error(`Sepolia chainKey ${chainKey} not in getSupportedChains()`);
    }

    onStatus?.("Confirming Sepolia transaction…");
    const receipt = await source.waitForTransaction(txHash, 1, 180_000);
    if (!receipt?.blockNumber) {
      throw new Error("Sepolia tx not mined");
    }
    if (receipt.status !== 1) {
      throw new Error("Sepolia tx failed (status != 1)");
    }

    onStatus?.(
      `Waiting for attestation of Sepolia block ${receipt.blockNumber} (can take minutes)…`,
    );

    const proverUrls = [primary, fallback].filter(
      (u, i, arr) => Boolean(u) && arr.indexOf(u) === i,
    );
    let lastErr: unknown;
    for (const proofUrl of proverUrls) {
      try {
        onStatus?.(`Using prover ${proofUrl}…`);
        const proofBuilder = new proofProvider.service.ProofBuilder(
          chainKey,
          proofUrl,
          5_000,
        );
        await proofBuilder.waitUntilHeightAttested(
          chainKey,
          receipt.blockNumber,
          15_000,
          1_200_000,
        );
        const result = await getProofWithRetries(proofBuilder, txHash, 4, onStatus);
        const data = result.data!;
        return {
          sepoliaTxHash: txHash,
          sepoliaBlockNumber: receipt.blockNumber,
          chainKey: data.chainKey,
          headerNumber: data.headerNumber,
          txIndex: data.txIndex,
          merkleRoot: data.merkleProof.root as Hex,
          siblings: data.merkleProof.siblings.map((s) => ({
            hash: s.hash as Hex,
            isLeft: s.isLeft,
          })),
          lowerEndpointDigest: data.continuityProof.lowerEndpointDigest as Hex,
          continuityRoots: data.continuityProof.roots as Hex[],
          txBytes: data.txBytes as Hex,
          cached: Boolean(data.cached),
        };
      } catch (err) {
        lastErr = err;
        if (looksLikeCors(err)) throw new ProveCorsError(txHash, err);
        onStatus?.(
          `Prover ${proofUrl} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } catch (err) {
    if (err instanceof ProveCorsError) throw err;
    if (looksLikeCors(err)) throw new ProveCorsError(txHash, err);
    throw err;
  }
}

/** Accept worker CLI JSON (`--json-out`) or a flat ProofPayload. */
export function parsePastableProof(raw: string, fallbackTx?: string): ProofPayload {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("proof JSON must be an object");
  }
  const obj = parsed as Record<string, unknown>;

  // Worker CLI shape: { sepoliaTxHash, sepoliaBlockNumber, chainKey, headerNumber, proof: {...} }
  if (obj.proof && typeof obj.proof === "object") {
    const proof = obj.proof as Record<string, unknown>;
    const merkle = proof.merkleProof as {
      root: string;
      siblings: { hash: string; isLeft: boolean }[];
    };
    const continuity = proof.continuityProof as {
      lowerEndpointDigest: string;
      roots: string[];
    };
    return {
      sepoliaTxHash: String(obj.sepoliaTxHash ?? fallbackTx ?? ""),
      sepoliaBlockNumber: Number(obj.sepoliaBlockNumber ?? 0),
      chainKey: Number(proof.chainKey ?? obj.chainKey ?? 1),
      headerNumber: Number(proof.headerNumber ?? obj.headerNumber),
      txIndex: Number(proof.txIndex ?? 0),
      merkleRoot: merkle.root as Hex,
      siblings: merkle.siblings.map((s) => ({
        hash: s.hash as Hex,
        isLeft: Boolean(s.isLeft),
      })),
      lowerEndpointDigest: continuity.lowerEndpointDigest as Hex,
      continuityRoots: continuity.roots as Hex[],
      txBytes: String(proof.txBytes) as Hex,
      cached: Boolean(proof.cached),
    };
  }

  // Flat ProofPayload shape
  return {
    sepoliaTxHash: String(obj.sepoliaTxHash ?? fallbackTx ?? ""),
    sepoliaBlockNumber: Number(obj.sepoliaBlockNumber ?? 0),
    chainKey: Number(obj.chainKey ?? 1),
    headerNumber: Number(obj.headerNumber),
    txIndex: Number(obj.txIndex ?? 0),
    merkleRoot: obj.merkleRoot as Hex,
    siblings: (obj.siblings as ProofPayload["siblings"]) ?? [],
    lowerEndpointDigest: obj.lowerEndpointDigest as Hex,
    continuityRoots: (obj.continuityRoots as Hex[]) ?? [],
    txBytes: obj.txBytes as Hex,
    cached: Boolean(obj.cached),
  };
}
