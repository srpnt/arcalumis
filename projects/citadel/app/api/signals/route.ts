// ============================================================
// Signals API — reads research/*.md files server-side
// ============================================================

import { NextResponse } from "next/server";
import { loadAllSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const signals = loadAllSignals();
    return NextResponse.json({ signals });
  } catch (error) {
    return NextResponse.json(
      { error: String(error), signals: [] },
      { status: 500 }
    );
  }
}
