import type { ServerResponse } from "node:http";
import type { NextRequest } from "next/server";
import handler from "../../../../api/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CapturedResponse = {
  statusCode: number;
  headers: Headers;
  body: string;
};

async function runMcpHandler(request: NextRequest): Promise<Response> {
  const body = await request.text();

  return new Promise((resolve) => {
    const captured: CapturedResponse = { statusCode: 200, headers: new Headers(), body: "" };
    const response = {
      get statusCode() {
        return captured.statusCode;
      },
      set statusCode(value: number) {
        captured.statusCode = value;
      },
      setHeader(name: string, value: number | string | readonly string[]) {
        captured.headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
      },
      end(value?: string) {
        captured.body = value ?? "";
        resolve(new Response(captured.body, { status: captured.statusCode, headers: captured.headers }));
      },
    } as unknown as ServerResponse;

    void handler(
      {
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
      } as never,
      response,
    );
  });
}

export async function POST(request: NextRequest) {
  return runMcpHandler(request);
}

export async function OPTIONS(request: NextRequest) {
  return runMcpHandler(request);
}
