// ============================================================
// Whale Watchlist API — serves whale-watchlist.json from disk
// ============================================================

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(
  process.env.HOME || "/home/piton",
  ".openclaw/workspace"
);
const WATCHLIST_PATH = join(WORKSPACE_DIR, "data/whale-watchlist.json");

export async function GET() {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    // File doesn't exist yet or is invalid — return empty
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ lastUpdated: null, whales: [] });
    }
    return NextResponse.json(
      { error: `Failed to read watchlist: ${String(err)}` },
      { status: 500 }
    );
  }
}
