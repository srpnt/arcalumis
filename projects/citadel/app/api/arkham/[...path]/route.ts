// ============================================================
// Arkham API Proxy — avoids Cloudflare 403
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getArkhamConfig(): { baseUrl: string; apiKey: string } {
  try {
    const credPath = path.join(
      process.env.HOME || "/home/piton",
      ".openclaw/credentials/apis.json"
    );
    const raw = fs.readFileSync(credPath, "utf-8");
    const creds = JSON.parse(raw);
    return {
      baseUrl: creds.arkham?.baseUrl || "https://api.arkm.com",
      apiKey: creds.arkham?.apiKey || "",
    };
  } catch {
    return { baseUrl: "https://api.arkm.com", apiKey: "" };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { apiKey, baseUrl } = getArkhamConfig();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Arkham API key not configured" },
      { status: 500 }
    );
  }

  const resolvedParams = await params;
  const arkhamPath = "/" + resolvedParams.path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${baseUrl}${arkhamPath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: {
        "API-Key": apiKey,
        Accept: "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 502 }
    );
  }
}
