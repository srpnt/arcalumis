// ============================================================
// Morpho GraphQL Proxy — avoids CORS
// ============================================================

import { NextRequest, NextResponse } from "next/server";

const MORPHO_API = process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(MORPHO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
