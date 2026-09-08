import type { IncomingMessage, ServerResponse } from "node:http";
import { createPublicClient, formatUnits, http, isAddress, type Address } from "viem";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_RPC,
  DESK_URL,
  addresses,
} from "../src/config/networks";
import {
  agentPassportAscAbi,
  agentPassportNftAbi,
  creditLineAbi,
  creditScoreAbi,
  passportNftAbi,
} from "../src/lib/abi";

type VercelRequest = IncomingMessage & { body?: unknown };
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

const creditcoinClient = createPublicClient({
  transport: http(CREDITCOIN_RPC, { timeout: 12_000, retryCount: 1 }),
});

function setHeaders(response: ServerResponse, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, mcp-protocol-version, mcp-session-id",
  );
  response.setHeader("Vary", "Origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function send(response: ServerResponse, payload: unknown, status = 200) {
  setHeaders(response, status);
  response.end(JSON.stringify(payload));
}

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function limited(request: VercelRequest): boolean {
  const forwarded = request.headers["x-forwarded-for"];
  const address = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "anonymous";
  const now = Date.now();
  const current = requests.get(address);

  if (!current || current.resetAt <= now) {
    requests.set(address, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function readBody(request: VercelRequest): Promise<string> {
  if (typeof request.body === "string") return request.body;
  if (request.body && typeof request.body === "object") return JSON.stringify(request.body);

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += next.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(next);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function walletFrom(args: unknown): Address {
  const wallet = typeof args === "object" && args !== null ? (args as { wallet?: unknown }).wallet : undefined;
  if (typeof wallet !== "string" || !isAddress(wallet)) {
    throw new Error("Provide a valid wallet address.");
  }
  return wallet;
}

function toolText(text: string) {
  return { content: [{ type: "text", text }] };
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
    deskUrl: `${DESK_URL}/app`,
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
    deskUrl: `${DESK_URL}/agent`,
  };
}

const tools = [
  {
    name: "get_credit_passport",
    description: "Read a wallet's public Credit Passport testnet record. This never asks for a private key or sends a transaction.",
    inputSchema: {
      type: "object",
      properties: { wallet: { type: "string", description: "EVM wallet address" } },
      required: ["wallet"],
      additionalProperties: false,
    },
  },
  {
    name: "get_agent_passport",
    description: "Read a wallet's public Agent Passport testnet record. This never asks for a private key or sends a transaction.",
    inputSchema: {
      type: "object",
      properties: { wallet: { type: "string", description: "EVM wallet address" } },
      required: ["wallet"],
      additionalProperties: false,
    },
  },
  {
    name: "get_credit_passport_links",
    description: "Get the public demo, agent workspace, documentation, and deployed testnet contract addresses.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

async function callTool(name: string, args: unknown) {
  if (name === "get_credit_passport") return toolText(JSON.stringify(await creditPassport(walletFrom(args)), null, 2));
  if (name === "get_agent_passport") return toolText(JSON.stringify(await agentPassport(walletFrom(args)), null, 2));
  if (name === "get_credit_passport_links") {
    return toolText(JSON.stringify({
      creditDesk: `${DESK_URL}/app`,
      agentDesk: `${DESK_URL}/agent`,
      documentation: `${DESK_URL}/docs#mcp`,
      chainId: CREDITCOIN_CHAIN_ID,
      contracts: {
        creditPassport: addresses.creditPassportAsc,
        agentPassport: addresses.agentPassportAsc,
      },
      safety: "This MCP server is read-only. Wallet approvals and transactions happen only in the browser wallet.",
    }, null, 2));
  }
  throw new Error(`Unknown tool: ${name}`);
}

export default async function handler(request: VercelRequest, response: ServerResponse) {
  if (request.method === "OPTIONS") {
    setHeaders(response, 204);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    send(response, { error: "Use POST with a JSON-RPC MCP request." }, 405);
    return;
  }

  if (limited(request)) {
    send(response, rpcError(null, -32029, "Too many requests. Try again in a minute."), 429);
    return;
  }

  try {
    const body = await readBody(request);
    if (!body || body.length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    const rpc = JSON.parse(body) as RpcRequest;
    if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      send(response, rpcError(rpc.id, -32600, "Invalid JSON-RPC request."));
      return;
    }

    if (rpc.method === "initialize") {
      send(response, rpcResult(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "credit-passport", version: "1.0.0" },
      }));
      return;
    }

    if (rpc.method === "notifications/initialized") {
      setHeaders(response, 202);
      response.end();
      return;
    }

    if (rpc.method === "tools/list") {
      send(response, rpcResult(rpc.id, { tools }));
      return;
    }

    if (rpc.method === "tools/call") {
      const params = rpc.params as { name?: unknown; arguments?: unknown } | undefined;
      if (!params || typeof params.name !== "string") {
        send(response, rpcError(rpc.id, -32602, "Provide a tool name."));
        return;
      }
      send(response, rpcResult(rpc.id, await callTool(params.name, params.arguments)));
      return;
    }

    send(response, rpcError(rpc.id, -32601, "Method not found."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete the request.";
    send(response, rpcError(null, -32000, message));
  }
}
