import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { handleMcp, MAX_MCP_BODY_BYTES } from "./mcp";
import { POST } from "../app/api/mcp/route";
import { NextRequest } from "next/server";

const call = (value: unknown, requester = "validation") => handleMcp(JSON.stringify(value), requester);

test("rejects malformed JSON and invalid request shapes without leaking errors", async () => {
  const malformed = await handleMcp("{", "parse");
  assert.equal((malformed.body as any).error.code, -32700);
  for (const input of [null, [], 1, "request", { jsonrpc: "2.0", method: "tools/list", id: {} }]) {
    assert.equal(((await call(input)).body as any).error.code, -32600);
  }
});

test("validates tools and wallet arguments and preserves correlation IDs", async () => {
  for (const params of [{ name: "unknown" }, { name: "get_credit_passport", arguments: { wallet: "bad" } }]) {
    const response = await call({ jsonrpc: "2.0", id: 42, method: "tools/call", params });
    assert.equal((response.body as any).id, 42);
    assert.equal((response.body as any).error.code, -32602);
  }
  const response = await call({ jsonrpc: "2.0", id: "list", method: "tools/list" });
  assert.equal((response.body as any).result.tools.length, 3);
});

test("measures body size in bytes", async () => {
  const response = await handleMcp("é".repeat(MAX_MCP_BODY_BYTES / 2 + 1), "bytes");
  assert.equal(response.status, 413);
});

test("bounds request bodies even without content-length", async () => {
  const request = new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    body: "x".repeat(MAX_MCP_BODY_BYTES + 1),
  });
  assert.equal(request.headers.get("content-length"), null);
  assert.equal((await POST(request)).status, 413);
});

test("zero token IDs mean no passport for both account types", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(64)}`,
  }), { headers: { "content-type": "application/json" } }));
  try {
    for (const name of ["get_credit_passport", "get_agent_passport"]) {
      const response = await call({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {
        name, arguments: { wallet: "0x0000000000000000000000000000000000000001" },
      } }, "zero-token");
      const record = JSON.parse((response.body as any).result.content[0].text);
      assert.equal(record.passportId, null);
    }
  } finally {
    fetchMock.mock.restore();
  }
});

test("network failures do not expose RPC details and retain the request ID", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("https://private-rpc.example/secret-api-key");
  });
  try {
    const response = await call({ jsonrpc: "2.0", id: 8, method: "tools/call", params: {
      name: "get_credit_passport", arguments: { wallet: "0x0000000000000000000000000000000000000001" },
    } }, "rpc-error");
    assert.equal((response.body as any).id, 8);
    assert.equal((response.body as any).error.code, -32000);
    assert.doesNotMatch(JSON.stringify(response), /private-rpc|secret-api-key/);
  } finally {
    fetchMock.mock.restore();
  }
});

test("enforces per-requester rate and refuses new entries when cache is full", async () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  for (let i = 0; i < 30; i++) assert.equal((await handleMcp(body, "rate")).status, 200);
  assert.equal((await handleMcp(body, "rate")).status, 429);
  for (let i = 0; i < 500; i++) await handleMcp(body, `capacity-${i}`);
  assert.equal((await handleMcp(body, "new-requester")).status, 429);
});
