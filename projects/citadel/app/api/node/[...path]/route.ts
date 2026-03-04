// ============================================================
// Execution Node API Proxy
// Proxies requests to the local execution node at localhost:4100
// ============================================================

import { NextRequest, NextResponse } from "next/server";

const NODE_BASE_URL = process.env.NODE_API_URL || "http://localhost:4100";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const nodePath = "/" + resolvedParams.path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${NODE_BASE_URL}${nodePath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(120000),
    });

    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Node is offline or unreachable — return graceful error
    const isTimeout =
      error instanceof DOMException && error.name === "TimeoutError";
    const isConnRefused =
      error instanceof TypeError &&
      String(error).includes("ECONNREFUSED");

    return NextResponse.json(
      {
        error: "Node offline",
        detail: isTimeout
          ? "Connection timed out"
          : isConnRefused
            ? "Connection refused"
            : String(error),
        offline: true,
      },
      { status: 503 }
    );
  }
}
