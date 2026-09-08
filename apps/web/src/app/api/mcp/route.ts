import { NextResponse, type NextRequest } from "next/server";
import { handleMcp } from "@/lib/mcp";

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
  const response = await handleMcp(await request.text(), requester(request));
  if (response.body === null) return new NextResponse(null, { status: response.status, headers: corsHeaders });
  return NextResponse.json(response.body, { status: response.status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
