import { NextResponse } from "next/server";
import { SEPOLIA_RPC, SEPOLIA_CHAIN_KEY, PROOF_BUILDER_URL, PROOF_BUILDER_URL_FALLBACK } from "@/config/networks";

type RouteContext = { params: Promise<{ chainKey: string; txHash: string }> };
type CachedProof = { expiresAt: number; proof: Record<string, unknown>; sepoliaBlockNumber: number };

const proofCache = new Map<string, CachedProof>();
const MAX_CACHE_ENTRIES = 256;
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isTxHash(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) throw new Error("Proof service response is too large");
    let data: unknown;
    try {
      data = body ? JSON.parse(body) : undefined;
    } catch {
      data = undefined;
    }
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method: string, params: unknown[]) {
  const { response, data } = await fetchJson(SEPOLIA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok || !data || typeof data !== "object" || !("result" in data)) {
    throw new Error("Sepolia RPC unavailable");
  }
  return (data as { result?: unknown }).result;
}

function isRetriable(status: number) {
  return status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function GET(_request: Request, context: RouteContext) {
  const { chainKey, txHash } = await context.params;
  if (chainKey !== String(SEPOLIA_CHAIN_KEY) || !isTxHash(txHash)) {
    return NextResponse.json({ status: "error", message: "Invalid proof request." }, { status: 400 });
  }

  const requester = _request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
  const now = Date.now();
  const current = requestCounts.get(requester);
  if (!current || current.resetAt <= now) {
    requestCounts.set(requester, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    current.count += 1;
    if (current.count > RATE_LIMIT) {
      return NextResponse.json(
        { status: "waiting", message: "Proof status is checking too often. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
      );
    }
  }

  const cacheKey = txHash.toLowerCase();
  const cached = proofCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ status: "ready", cached: true, ...cached }, { headers: { "Cache-Control": "no-store" } });
  }
  if (cached) proofCache.delete(cacheKey);

  try {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (!receipt || typeof receipt !== "object") {
      return NextResponse.json({ status: "waiting", message: "Waiting for the Sepolia transaction to be mined." }, { headers: { "Cache-Control": "no-store" } });
    }
    const receiptRecord = receipt as { blockNumber?: unknown; status?: unknown };
    const blockNumber = typeof receiptRecord.blockNumber === "string" ? Number.parseInt(receiptRecord.blockNumber, 16) : 0;
    if (!Number.isSafeInteger(blockNumber) || blockNumber < 1) {
      return NextResponse.json({ status: "waiting", message: "Waiting for the Sepolia transaction to be mined." }, { headers: { "Cache-Control": "no-store" } });
    }
    if (receiptRecord.status !== "0x1") {
      return NextResponse.json({ status: "error", message: "The Sepolia transaction failed." }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    let attestedHeight = 0;
    let lastError = "";
    for (const base of [PROOF_BUILDER_URL, PROOF_BUILDER_URL_FALLBACK]) {
      try {
        const { response, data } = await fetchJson(
          `${base}/api/v1/attested-height/${SEPOLIA_CHAIN_KEY}`,
        );
        if (response.ok && data && typeof data === "object" && typeof (data as { attestedHeight?: unknown }).attestedHeight === "number") {
          attestedHeight = Math.max(attestedHeight, (data as { attestedHeight: number }).attestedHeight);
        } else if (!isRetriable(response.status)) {
          lastError = `Proof service returned HTTP ${response.status}`;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Proof service unavailable";
      }
    }

    if (attestedHeight < blockNumber) {
      return NextResponse.json({ status: "waiting", attestedHeight, sourceBlockNumber: blockNumber, message: "Waiting for Creditcoin to attest this Sepolia block." }, { headers: { "Cache-Control": "no-store" } });
    }

    for (const base of [PROOF_BUILDER_URL, PROOF_BUILDER_URL_FALLBACK]) {
      try {
        const { response, data } = await fetchJson(
          `${base}/api/v1/proof-by-tx/${SEPOLIA_CHAIN_KEY}/${txHash}`,
        );
        if (response.ok && data && typeof data === "object") {
          const entry = { expiresAt: Date.now() + CACHE_TTL_MS, proof: data as Record<string, unknown>, sepoliaBlockNumber: blockNumber };
          while (proofCache.size >= MAX_CACHE_ENTRIES) proofCache.delete(proofCache.keys().next().value as string);
          proofCache.set(cacheKey, entry);
          return NextResponse.json({ status: "ready", cached: false, ...entry }, { headers: { "Cache-Control": "no-store" } });
        }
        if (!isRetriable(response.status)) lastError = `Proof service returned HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Proof service unavailable";
      }
    }

    return NextResponse.json({ status: "waiting", attestedHeight, sourceBlockNumber: blockNumber, message: lastError || "The proof is being indexed; checking again shortly." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ status: "waiting", message: error instanceof Error ? error.message : "Proof services are temporarily unavailable." }, { headers: { "Cache-Control": "no-store" } });
  }
}
