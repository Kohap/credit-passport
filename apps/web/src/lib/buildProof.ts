import { JsonRpcProvider, isHexString } from "ethers";
import type { Hex } from "viem";
import {
  PROOF_BUILDER_URL,
  PROOF_BUILDER_URL_FALLBACK,
  SEPOLIA_CHAIN_KEY,
  SEPOLIA_RPC,
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

type ProverResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: ProverFailure };

const PROVER_POLL_MS = 5_000;
const PROVER_TIMEOUT_MS = 1_200_000;
const PROVER_REQUEST_WINDOW_MS = 60_000;
const MAX_PROVER_REQUESTS_PER_WINDOW = 30;
const MAX_PROOF_JSON_BYTES = 1_000_000;
const MAX_TX_BYTES = 512_000;
const MAX_PROOF_NODES = 1_024;
const proverRequestTimes: number[] = [];

async function fetchHostedProofStatus(txHash: string, onStatus?: (msg: string) => void) {
  const response = await fetch(`/api/proof-status/${SEPOLIA_CHAIN_KEY}/${txHash}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json()) as {
    status?: string;
    message?: string;
    proof?: ProverResponse;
    sepoliaBlockNumber?: number;
    attestedHeight?: number;
  };
  if (data.status === "ready" && data.proof && typeof data.sepoliaBlockNumber === "number") {
    return toProofPayload(txHash, data.sepoliaBlockNumber, data.proof);
  }
  if (data.status === "error") throw new Error(data.message || "Proof verification failed");
  if (data.attestedHeight !== undefined) {
    onStatus?.(`Waiting for attestation: Creditcoin has reached block ${data.attestedHeight}.`);
  } else if (data.message) {
    onStatus?.(data.message);
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProverUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

function getMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message) return message.slice(0, 300);
  }
  return fallback;
}

function reserveProverRequest() {
  const now = Date.now();
  while (proverRequestTimes[0] !== undefined && now - proverRequestTimes[0] >= PROVER_REQUEST_WINDOW_MS) {
    proverRequestTimes.shift();
  }
  if (proverRequestTimes.length >= MAX_PROVER_REQUESTS_PER_WINDOW) {
    throw new Error("Proof request limit reached. Wait a minute before trying again.");
  }
  proverRequestTimes.push(now);
}

async function fetchProverJson<T>(base: string, path: string): Promise<ProverResult<T>> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    reserveProverRequest();
    response = await fetch(makeProverUrl(base, path), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (cause) {
    throw new ProverNetworkError(cause);
  } finally {
    clearTimeout(timeout);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_PROOF_JSON_BYTES) {
    throw new Error("Proof service response is too large.");
  }
  const body = await response.text();
  if (body.length > MAX_PROOF_JSON_BYTES) {
    throw new Error("Proof service response is too large.");
  }
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

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asSafeInteger(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer`);
  }
  return value;
}

function asHex(value: unknown, field: string, bytes?: number, maxBytes?: number): Hex {
  if (typeof value !== "string" || !isHexString(value, bytes)) {
    throw new Error(`${field} must be valid hex`);
  }
  const size = (value.length - 2) / 2;
  if (maxBytes !== undefined && size > maxBytes) {
    throw new Error(`${field} exceeds the maximum size`);
  }
  return value as Hex;
}

function normaliseProofPayload(
  source: Record<string, unknown>,
  txHash: string,
  sepoliaBlockNumber: number,
): ProofPayload {
  const chainKey = asSafeInteger(source.chainKey, "chainKey", 1);
  if (chainKey !== SEPOLIA_CHAIN_KEY) {
    throw new Error("Proof was generated for an unexpected source chain");
  }
  const headerNumber = asSafeInteger(source.headerNumber, "headerNumber", 1);
  const txIndex = asSafeInteger(source.txIndex ?? 0, "txIndex");
  const siblings = source.siblings;
  const continuityRoots = source.continuityRoots;
  if (!Array.isArray(siblings) || siblings.length > MAX_PROOF_NODES) {
    throw new Error("siblings must be a bounded array");
  }
  if (!Array.isArray(continuityRoots) || continuityRoots.length > MAX_PROOF_NODES) {
    throw new Error("continuityRoots must be a bounded array");
  }

  return {
    sepoliaTxHash: asHex(txHash, "sepoliaTxHash", 32),
    sepoliaBlockNumber: asSafeInteger(sepoliaBlockNumber, "sepoliaBlockNumber"),
    chainKey,
    headerNumber,
    txIndex,
    merkleRoot: asHex(source.merkleRoot, "merkleRoot", 32),
    siblings: siblings.map((entry, index) => {
      const node = asRecord(entry, `siblings[${index}]`);
      if (typeof node.isLeft !== "boolean") {
        throw new Error(`siblings[${index}].isLeft must be boolean`);
      }
      return { hash: asHex(node.hash, `siblings[${index}].hash`, 32), isLeft: node.isLeft };
    }),
    lowerEndpointDigest: asHex(source.lowerEndpointDigest, "lowerEndpointDigest", 32),
    continuityRoots: continuityRoots.map((root, index) =>
      asHex(root, `continuityRoots[${index}]`, 32),
    ),
    txBytes: asHex(source.txBytes, "txBytes", undefined, MAX_TX_BYTES),
    cached: Boolean(source.cached),
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
  return normaliseProofPayload(
    {
      chainKey: data.chainKey,
      headerNumber: data.headerNumber,
      txIndex: data.txIndex,
      merkleRoot: data.merkleProof.root,
      siblings: data.merkleProof.siblings,
      lowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
      continuityRoots: data.continuityProof.roots,
      txBytes: data.txBytes,
      cached: data.cached,
    },
    txHash,
    sepoliaBlockNumber,
  );
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

  const sepoliaRpc = SEPOLIA_RPC;
  const primary = PROOF_BUILDER_URL;
  const fallback = PROOF_BUILDER_URL_FALLBACK;
  const chainKey = SEPOLIA_CHAIN_KEY;

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

    // Prefer the hosted route: it retries both provers and keeps completed proofs warm.
    const hostedDeadline = Date.now() + PROVER_TIMEOUT_MS;
    while (Date.now() < hostedDeadline) {
      try {
        const hostedProof = await fetchHostedProofStatus(txHash, onStatus);
        if (hostedProof) return hostedProof;
        await sleep(PROVER_POLL_MS);
      } catch {
        onStatus?.("Hosted proof status is unavailable; trying the direct prover path…");
        break;
      }
    }

    const proverUrls = [
      "/api/prover",
      primary,
      "/api/prover-fallback",
      fallback,
    ].filter(
      (u, i, arr) => Boolean(u) && arr.indexOf(u) === i,
    );
    const chosenProver = await chooseProver(
      proverUrls,
      chainKey,
      txHash,
      onStatus,
    );
    const deadline = Date.now() + PROVER_TIMEOUT_MS;
    let proofUrl = chosenProver.proofUrl;
    let proverIndex = Math.max(proverUrls.indexOf(proofUrl), 0);
    let latestAttestedHeight = chosenProver.attestedHeight;

    function useNextProver() {
      proverIndex = (proverIndex + 1) % proverUrls.length;
      proofUrl = proverUrls[proverIndex];
    }

    while (Date.now() < deadline) {
      if (latestAttestedHeight < receipt.blockNumber) {
        onStatus?.(
          `Waiting for attestation: proof service has ${latestAttestedHeight}; repayment is in ${receipt.blockNumber}.`,
        );
        await sleep(PROVER_POLL_MS);
        let height: ProverResult<{ attestedHeight?: unknown }>;
        try {
          height = await fetchProverJson<{ attestedHeight?: unknown }>(
            proofUrl,
            `/api/v1/attested-height/${chainKey}`,
          );
        } catch (error) {
          if (!(error instanceof ProverNetworkError)) throw error;
          useNextProver();
          onStatus?.("Proof service connection dropped; trying the backup service...");
          continue;
        }
        if (!height.ok) {
          if (!height.failure.retriable) throw new Error(height.failure.message);
          useNextProver();
          onStatus?.("Proof service is temporarily unavailable; trying the backup service...");
          continue;
        }
        if (typeof height.data.attestedHeight !== "number") {
          throw new Error("Proof service returned no attested height");
        }
        latestAttestedHeight = height.data.attestedHeight;
        continue;
      }

      onStatus?.("Generating Merkle + continuity proof…");
      let proof: ProverResult<ProverResponse>;
      try {
        proof = await fetchProverJson<ProverResponse>(
          proofUrl,
          `/api/v1/proof-by-tx/${chainKey}/${txHash}`,
        );
      } catch (error) {
        if (!(error instanceof ProverNetworkError)) throw error;
        useNextProver();
        onStatus?.("Proof service connection dropped; trying the backup service...");
        await sleep(PROVER_POLL_MS);
        continue;
      }
      if (proof.ok) return toProofPayload(txHash, receipt.blockNumber, proof.data);
      if (!proof.failure.retriable) throw new Error(proof.failure.message);

      useNextProver();
      onStatus?.("Proof service is indexing the attested block; trying the backup service...");
      await sleep(PROVER_POLL_MS);
      let height: ProverResult<{ attestedHeight?: unknown }>;
      try {
        height = await fetchProverJson<{ attestedHeight?: unknown }>(
          proofUrl,
          `/api/v1/attested-height/${chainKey}`,
        );
      } catch (error) {
        if (!(error instanceof ProverNetworkError)) throw error;
        useNextProver();
        continue;
      }
      if (!height.ok) {
        if (!height.failure.retriable) throw new Error(height.failure.message);
        useNextProver();
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
  if (raw.length > MAX_PROOF_JSON_BYTES) {
    throw new Error("proof JSON exceeds the maximum size");
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("proof JSON must be an object");
  }
  const obj = parsed as Record<string, unknown>;
  const pastedTx = String(obj.sepoliaTxHash ?? fallbackTx ?? "");
  if (
    fallbackTx &&
    isHexString(pastedTx, 32) &&
    pastedTx.toLowerCase() !== fallbackTx.toLowerCase()
  ) {
    throw new Error("proof JSON belongs to a different Sepolia repayment");
  }

  // Canonical flat document (ADR-0003)
  if (typeof obj.merkleRoot === "string" && typeof obj.txBytes === "string") {
    return normaliseProofPayload(
      obj,
      pastedTx,
      Number(obj.sepoliaBlockNumber ?? 0),
    );
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
    return normaliseProofPayload(
      {
        chainKey: proof.chainKey ?? obj.chainKey ?? 1,
        headerNumber: proof.headerNumber ?? obj.headerNumber,
        txIndex: proof.txIndex ?? 0,
        merkleRoot: merkle.root,
        siblings: merkle.siblings,
        lowerEndpointDigest: continuity.lowerEndpointDigest,
        continuityRoots: continuity.roots,
        txBytes: proof.txBytes,
        cached: proof.cached,
      },
      pastedTx,
      Number(obj.sepoliaBlockNumber ?? 0),
    );
  }

  throw new Error(
    "Not a canonical proof document (need merkleRoot + txBytes). Re-run: npm run prove -- <tx> --json-out proof.json",
  );
}
