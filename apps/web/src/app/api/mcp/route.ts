import { NextResponse, type NextRequest } from "next/server";
import { handleMcp, MAX_MCP_BODY_BYTES } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};

function requester(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anonymous";
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_BODY_BYTES) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Request body is too large." } },
      { status: 413, headers: corsHeaders },
    );
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_MCP_BODY_BYTES) {
          await reader.cancel();
          return NextResponse.json(
            { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request body is too large." } },
            { status: 413, headers: corsHeaders },
          );
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    }
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Unable to read request." } },
      { status: 400, headers: corsHeaders },
    );
  } finally {
    reader?.releaseLock();
  }
  const response = await handleMcp(body, requester(request));
  if (response.body === null) return new NextResponse(null, { status: response.status, headers: corsHeaders });
  return NextResponse.json(response.body, { status: response.status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
