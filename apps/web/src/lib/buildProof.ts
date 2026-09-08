import { JsonRpcProvider, isHexString } from "ethers";
import type { Hex } from "viem";
import {
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

class ProverNetworkError extends Error {
  constructor(cause?: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause ?? "");
    super(detail || "Unable to reach the proof service");
    this.name = "ProverNetworkError";
  }
}

type ProverResponse = {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txBytes: Hex;
  merkleProof: { root: Hex; siblings: { hash: Hex; isLeft: boolean }[] };
  continuityProof: { lowerEndpointDigest: Hex; roots: Hex[] };
  cached?: boolean;
};

type ProverFailure = {
  status: number;
  message: string;
  retriable: boolean;
};

const PROVER_POLL_MS = 5_000;
const PROVER_TIMEOUT_MS = 1_200_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProverUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

function getMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

async function fetchProverJson<T>(base: string, path: string): Promise<
  | { ok: true; data: T }
  | { ok: false; failure: ProverFailure }
> {
  let response: Response;
  try {
    response = await fetch(makeProverUrl(base, path), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new ProverNetworkError(cause);
  }

  const body = await response.text();
  let data: unknown = body;
  try {
    data = body ? JSON.parse(body) : undefined;
  } catch {
    // Non-JSON responses are reported below with their HTTP status.
  }

  if (response.ok) return { ok: true, data: data as T };

  return {
    ok: false,
    failure: {
      status: response.status,
      message: getMessage(data, `Prover returned HTTP ${response.status}`),
      retriable:
        response.status === 404 ||
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500 ||
        Boolean(
          data &&
            typeof data === "object" &&
            (data as { retriable?: unknown }).retriable,
        ),
    },
  };
}

async function chooseProver(
  proverUrls: string[],
  chainKey: number,
  txHash: string,
  onStatus?: (msg: string) => void,
) {
  let lastFailure: ProverFailure | undefined;
  let networkFailure: unknown;

  for (const proofUrl of proverUrls) {
    try {
      onStatus?.(`Connecting to proof service…`);
      const result = await fetchProverJson<{ attestedHeight?: unknown }>(
        proofUrl,
        `/api/v1/attested-height/${chainKey}`,
      );
      if (result.ok && typeof result.data.attestedHeight === "number") {
        return { proofUrl, attestedHeight: result.data.attestedHeight };
      }
      lastFailure = result.ok
        ? {
            status: 200,
            message: "Proof service returned no attested height",
            retriable: false,
          }
        : result.failure;
    } catch (err) {
      networkFailure = err;
      onStatus?.("Proof service connection failed; trying the next service…");
    }
  }

  if (networkFailure && !lastFailure) {
    throw new ProveCorsError(txHash, networkFailure);
  }
  throw new Error(lastFailure?.message ?? "No proof service is available");
}

function toProofPayload(
  txHash: string,
  sepoliaBlockNumber: number,
  data: ProverResponse,
): ProofPayload {
  if (
    !data.txBytes ||
    !data.merkleProof?.root ||
    !Array.isArray(data.merkleProof.siblings) ||
    !data.continuityProof?.lowerEndpointDigest ||
    !Array.isArray(data.continuityProof.roots)
  ) {
    throw new Error("Proof service returned an incomplete proof");
  }
  return {
    sepoliaTxHash: txHash,
    sepoliaBlockNumber,
    chainKey: data.chainKey,
    headerNumber: data.headerNumber,
    txIndex: data.txIndex,
    merkleRoot: data.merkleProof.root,
    siblings: data.merkleProof.siblings,
    lowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
    continuityRoots: data.continuityProof.roots,
    txBytes: data.txBytes,
    cached: Boolean(data.cached),
  };
}

/**
 * Build an Attestcoin proof in the browser. Vercel rewrites proxy the hosted provers so
 * browser CORS policy cannot interrupt the desk flow. GitHub Pages falls back to direct URLs.
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

    onStatus?.("Confirming Sepolia transaction…");
    const receipt =
      (await source.getTransactionReceipt(txHash)) ??
      (await source.waitForTransaction(txHash, 1, 180_000));
    if (!receipt?.blockNumber) {
      throw new Error("Sepolia tx not mined");
    }
    if (receipt.status !== 1) {
      throw new Error("Sepolia tx failed (status != 1)");
    }

    onStatus?.(
      `Waiting for attestation of Sepolia block ${receipt.blockNumber} (can take minutes)…`,
    );

    const proverUrls = [
      "/api/prover",
      primary,
      "/api/prover-fallback",
      fallback,
    ].filter(
      (u, i, arr) => Boolean(u) && arr.indexOf(u) === i,
    );
    const { proofUrl, attestedHeight } = await chooseProver(
      proverUrls,
      chainKey,
      txHash,
      onStatus,
    );
    const deadline = Date.now() + PROVER_TIMEOUT_MS;
    let latestAttestedHeight = attestedHeight;

    while (Date.now() < deadline) {
      if (latestAttestedHeight < receipt.blockNumber) {
        onStatus?.(
          `Waiting for attestation: proof service has ${latestAttestedHeight}; repayment is in ${receipt.blockNumber}.`,
        );
        await sleep(PROVER_POLL_MS);
        const height = await fetchProverJson<{ attestedHeight?: unknown }>(
          proofUrl,
          `/api/v1/attested-height/${chainKey}`,
        );
        if (!height.ok) {
          if (!height.failure.retriable) throw new Error(height.failure.message);
          onStatus?.(`Proof service is temporarily unavailable; retrying…`);
          continue;
        }
        if (typeof height.data.attestedHeight !== "number") {
          throw new Error("Proof service returned no attested height");
        }
        latestAttestedHeight = height.data.attestedHeight;
        continue;
      }

      onStatus?.("Generating Merkle + continuity proof…");
      const proof = await fetchProverJson<ProverResponse>(
        proofUrl,
        `/api/v1/proof-by-tx/${chainKey}/${txHash}`,
      );
      if (proof.ok) return toProofPayload(txHash, receipt.blockNumber, proof.data);
      if (!proof.failure.retriable) throw new Error(proof.failure.message);

      onStatus?.("Proof service is indexing the attested block; retrying…");
      await sleep(PROVER_POLL_MS);
      const height = await fetchProverJson<{ attestedHeight?: unknown }>(
        proofUrl,
        `/api/v1/attested-height/${chainKey}`,
      );
      if (!height.ok) {
        if (!height.failure.retriable) throw new Error(height.failure.message);
        continue;
      }
      if (typeof height.data.attestedHeight !== "number") {
        throw new Error("Proof service returned no attested height");
      }
      latestAttestedHeight = height.data.attestedHeight;
    }

    throw new Error(
      "Proof service did not attest this repayment within 20 minutes. Try again shortly.",
    );
  } catch (err) {
    if (err instanceof ProveCorsError) throw err;
    throw err;
  }
}

/**
 * Parse the canonical flat proof document (worker `--json-out` / Desk paste).
 * Thin fallback: older nested `{ proof: { merkleProof, continuityProof } }` CLI dumps.
 */
export function parsePastableProof(raw: string, fallbackTx?: string): ProofPayload {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("proof JSON must be an object");
  }
  const obj = parsed as Record<string, unknown>;

  // Canonical flat document (ADR-0003)
  if (typeof obj.merkleRoot === "string" && typeof obj.txBytes === "string") {
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

  // Legacy nested worker dump — remove once all proof.json files are flat
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
    if (!merkle?.root || !continuity?.lowerEndpointDigest || !proof.txBytes) {
      throw new Error("legacy nested proof missing merkleProof / continuityProof / txBytes");
    }
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

  throw new Error(
    "Not a canonical proof document (need merkleRoot + txBytes). Re-run: npm run prove -- <tx> --json-out proof.json",
  );
}
