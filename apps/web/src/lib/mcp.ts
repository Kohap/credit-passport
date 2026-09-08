import { createPublicClient, formatUnits, http, isAddress, type Address } from "viem";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_RPC,
  DESK_URL,
  addresses,
} from "@/config/networks";
import {
  agentPassportAscAbi,
  agentPassportNftAbi,
  creditLineAbi,
  creditScoreAbi,
  passportNftAbi,
} from "@/lib/abi";

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

const PROTOCOL_VERSION = "2025-06-18";
const MAX_BODY_BYTES = 64_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const requests = new Map<string, { count: number; resetAt: number }>();
const APP_ORIGIN = DESK_URL.replace(/\/$/, "");

const creditcoinClient = createPublicClient({
  transport: http(CREDITCOIN_RPC, { timeout: 12_000, retryCount: 1 }),
});

function result(id: RpcRequest["id"], value: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}

function error(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function rateLimited(requester: string): boolean {
  const now = Date.now();
  const current = requests.get(requester);

  if (!current || current.resetAt <= now) {
    requests.set(requester, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT;
}

function walletFrom(args: unknown): Address {
  const wallet = typeof args === "object" && args !== null ? (args as { wallet?: unknown }).wallet : undefined;
  if (typeof wallet !== "string" || !isAddress(wallet)) throw new Error("Provide a valid wallet address.");
  return wallet;
}

function text(value: string) {
  return { content: [{ type: "text", text: value }] };
}

async function creditPassport(wallet: Address) {
  const [score, repayments, borrowingLimit, availableToBorrow, outstanding] = await Promise.all([
    creditcoinClient.readContract({ address: addresses.creditScore as Address, abi: creditScoreAbi, functionName: "scoreOf", args: [wallet] }),
    creditcoinClient.readContract({ address: addresses.creditScore as Address, abi: creditScoreAbi, functionName: "repaymentCountOf", args: [wallet] }),
    creditcoinClient.readContract({ address: addresses.creditLine as Address, abi: creditLineAbi, functionName: "borrowCapOf", args: [wallet] }),
    creditcoinClient.readContract({ address: addresses.creditLine as Address, abi: creditLineAbi, functionName: "available", args: [wallet] }),
    creditcoinClient.readContract({ address: addresses.creditLine as Address, abi: creditLineAbi, functionName: "debtOf", args: [wallet] }),
  ]);

  let passportId: string | null = null;
  try {
    passportId = (await creditcoinClient.readContract({
      address: addresses.passportNft as Address,
      abi: passportNftAbi,
      functionName: "tokenOf",
      args: [wallet],
    })).toString();
  } catch {
    passportId = null;
  }

  return {
    wallet,
    network: "Creditcoin CC3 testnet",
    passportId,
    score: score.toString(),
    verifiedRepayments: repayments.toString(),
    borrowingLimit: `${formatUnits(borrowingLimit, 18)} mUSD`,
    availableToBorrow: `${formatUnits(availableToBorrow, 18)} mUSD`,
    outstanding: `${formatUnits(outstanding, 18)} mUSD`,
    nextStep: passportId ? "Open the Credit Desk to view your record." : "Start the credit demo to earn a record.",
    deskUrl: `${APP_ORIGIN}/app`,
  };
}

async function agentPassport(wallet: Address) {
  const [completedJobs, settledVolume] = await Promise.all([
    creditcoinClient.readContract({
      address: addresses.agentPassportAsc as Address,
      abi: agentPassportAscAbi,
      functionName: "completedJobsOf",
      args: [wallet],
    }),
    creditcoinClient.readContract({
      address: addresses.agentPassportAsc as Address,
      abi: agentPassportAscAbi,
      functionName: "settledVolumeOf",
      args: [wallet],
    }),
  ]);

  let passportId: string | null = null;
  try {
    passportId = (await creditcoinClient.readContract({
      address: addresses.agentPassportNft as Address,
      abi: agentPassportNftAbi,
      functionName: "tokenOf",
      args: [wallet],
    })).toString();
  } catch {
    passportId = null;
  }

  return {
    wallet,
    network: "Creditcoin CC3 testnet",
    passportId,
    completedJobs: completedJobs.toString(),
    settledVolume: `${formatUnits(settledVolume, 18)} mUSD`,
    nextStep: passportId ? "Open Agent Passport to view the work record." : "Open Agent Passport to record completed work.",
    deskUrl: `${APP_ORIGIN}/agent`,
  };
}

const tools = [
  {
    name: "get_credit_passport",
    description: "Read a wallet's public Credit Passport testnet record. This never asks for a private key or sends a transaction.",
    inputSchema: { type: "object", properties: { wallet: { type: "string", description: "EVM wallet address" } }, required: ["wallet"], additionalProperties: false },
  },
  {
    name: "get_agent_passport",
    description: "Read a wallet's public Agent Passport testnet record. This never asks for a private key or sends a transaction.",
    inputSchema: { type: "object", properties: { wallet: { type: "string", description: "EVM wallet address" } }, required: ["wallet"], additionalProperties: false },
  },
  {
    name: "get_credit_passport_links",
    description: "Get the public demo, agent workspace, documentation, and deployed testnet contract addresses.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

async function callTool(name: string, args: unknown) {
  if (name === "get_credit_passport") return text(JSON.stringify(await creditPassport(walletFrom(args)), null, 2));
  if (name === "get_agent_passport") return text(JSON.stringify(await agentPassport(walletFrom(args)), null, 2));
  if (name === "get_credit_passport_links") {
    return text(JSON.stringify({
      creditDesk: `${APP_ORIGIN}/app`,
      agentDesk: `${APP_ORIGIN}/agent`,
      documentation: `${APP_ORIGIN}/docs#mcp`,
      chainId: CREDITCOIN_CHAIN_ID,
      contracts: { creditPassport: addresses.creditPassportAsc, agentPassport: addresses.agentPassportAsc },
      safety: "This MCP server is read-only. Wallet approvals and transactions happen only in the browser wallet.",
    }, null, 2));
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function handleMcp(body: string, requester: string) {
  if (rateLimited(requester)) return { status: 429, body: error(null, -32029, "Too many requests. Try again in a minute.") };

  try {
    if (!body || body.length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    const rpc = JSON.parse(body) as RpcRequest;
    if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      return { status: 200, body: error(rpc.id, -32600, "Invalid JSON-RPC request.") };
    }
    if (rpc.method === "initialize") {
      return { status: 200, body: result(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "credit-passport", version: "1.0.0" },
      }) };
    }
    if (rpc.method === "tools/list") return { status: 200, body: result(rpc.id, { tools }) };
    if (rpc.method === "tools/call") {
      const params = rpc.params as { name?: unknown; arguments?: unknown } | undefined;
      if (!params || typeof params.name !== "string") return { status: 200, body: error(rpc.id, -32602, "Provide a tool name.") };
      return { status: 200, body: result(rpc.id, await callTool(params.name, params.arguments)) };
    }
    if (rpc.method === "notifications/initialized") return { status: 202, body: null };
    return { status: 200, body: error(rpc.id, -32601, "Method not found.") };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to complete the request.";
    return { status: 200, body: error(null, -32000, message) };
  }
}
